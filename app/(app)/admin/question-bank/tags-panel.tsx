// app/(app)/admin/question-bank/tags-panel.tsx
//
// The Tags panel (08 B4): every tag in the bank — every course — with how
// many questions carry it; rename, merge and delete. Tags are one list
// across the bank (Sam, 2026-09-26), so a change here reaches every
// course. Rename to a new word asks nothing (it can be renamed back);
// renaming onto a tag already in use is a merge, and a merge or a delete
// cannot be undone, so both ask first in the app's dialog — delete makes
// the admin type the tag. Results come back as toasts through the page.
// A card on the page rather than a dialog, so a long list has room; it
// sits beside its one caller (folder convention #3).

'use client';

import { useEffect, useState } from 'react';
import { deleteTag, loadTagCounts, renameTag } from '@/lib/bank/actions';
import type { TagChangeResult, TagCount, TagListResult } from '@/lib/bank/types';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

type Notify = (text: string, tone: 'error' | 'success') => void;
type Editing = { tag: string; mode: 'rename' | 'merge'; value: string } | null;

const questions = (n: number) => `${n} question${n === 1 ? '' : 's'}`;

export function TagsPanel({
  onClose,
  onChanged,
  notify,
}: {
  onClose: () => void;
  /** After a change: the page re-reads its course so the cards show it. */
  onChanged: () => Promise<void> | void;
  notify: Notify;
}) {
  const [result, setResult] = useState<TagListResult | null>(null);
  const [find, setFind] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    let live = true;
    loadTagCounts().then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, []);

  const tags: TagCount[] = result?.ok ? result.tags : [];
  const shown = find.trim() ? tags.filter((t) => t.tag.toLowerCase().includes(find.trim().toLowerCase())) : tags;
  const countOf = (tag: string) => tags.find((t) => t.tag === tag)?.count ?? 0;

  async function run(action: Promise<TagChangeResult>, done: (n: number) => string) {
    setBusy(true);
    try {
      const r = await action;
      if (!r.ok) return notify(r.error, 'error');
      notify(done(r.changed), 'success');
      setEditing(null);
      setResult(await loadTagCounts());
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function mergeInto(from: string, into: string) {
    const ok = await confirm({
      title: `Merge “${from}” into “${into}”?`,
      body: `The ${questions(countOf(from))} tagged “${from}” will carry “${into}” instead, and “${from}” will be gone. This cannot be undone.`,
      confirmLabel: 'Merge tags',
      danger: true,
    });
    if (!ok) return;
    await run(renameTag(from, into), (n) => `“${from}” merged into “${into}” on ${questions(n)}.`);
  }

  async function submitRename(from: string, value: string) {
    const to = value.trim().replace(/\s+/g, ' ');
    if (!to) return notify('Please enter the new name.', 'error');
    if (to === from) return setEditing(null);
    // onto another tag already in use: that is a merge, and it asks first
    const target = tags.find((t) => t.tag !== from && t.tag.toLowerCase() === to.toLowerCase());
    if (target && target.tag.toLowerCase() !== from.toLowerCase()) return mergeInto(from, target.tag);
    await run(renameTag(from, to), (n) => `“${from}” renamed to “${to}” on ${questions(n)}.`);
  }

  async function remove(tag: string) {
    const ok = await confirm({
      title: `Delete the tag “${tag}”?`,
      body: `It comes off all ${questions(countOf(tag))} that carry it, in every course. The questions themselves stay. This cannot be undone.`,
      confirmLabel: 'Delete tag',
      danger: true,
      typeToConfirm: tag,
    });
    if (!ok) return;
    await run(deleteTag(tag), (n) => `“${tag}” removed from ${questions(n)}.`);
  }

  return (
    <section className="qb-card-panel" aria-labelledby="qbTagsTitle">
      {confirmDialog}
      <div className="qb-card-panel-head">
        <h3 id="qbTagsTitle">Tags — whole bank</h3>
        <button type="button" className="panel-close" onClick={onClose} title="Close">✕</button>
      </div>
      <p className="qb-card-panel-note">
        One list across every course: a rename, merge or delete here changes the tag on every question that carries it, in every course.
      </p>

      {result === null ? (
        <p className="qb-card-panel-empty">Loading tags…</p>
      ) : !result.ok ? (
        <p className="qb-card-panel-empty">{result.error}</p>
      ) : tags.length === 0 ? (
        <p className="qb-card-panel-empty">No tags yet. Add them in a question’s editor, or in a CSV file’s tags column.</p>
      ) : (
        <>
          <input
            type="text"
            className="qb-card-panel-find"
            placeholder={`Find a tag among ${tags.length}…`}
            aria-label="Find a tag"
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
          <ul className="tag-list">
            {shown.map((t) => {
              const open = editing?.tag === t.tag ? editing : null;
              return (
                <li key={t.tag} className="tag-row">
                  <div className="tag-row-main">
                    <span className="tag-chip">{t.tag}</span>
                    <span className="tag-count">{questions(t.count)}</span>
                  </div>

                  {open?.mode === 'rename' ? (
                    <form
                      className="tag-row-edit"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitRename(t.tag, open.value);
                      }}
                    >
                      <input
                        type="text"
                        aria-label={`New name for ${t.tag}`}
                        value={open.value}
                        autoFocus
                        onChange={(e) => setEditing({ ...open, value: e.target.value })}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Save</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : open?.mode === 'merge' ? (
                    <div className="tag-row-edit">
                      <select
                        aria-label={`Merge ${t.tag} into`}
                        value={open.value}
                        onChange={(e) => setEditing({ ...open, value: e.target.value })}
                      >
                        <option value="">Merge into…</option>
                        {tags.filter((o) => o.tag !== t.tag).map((o) => <option key={o.tag} value={o.tag}>{o.tag}</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy || !open.value}
                        onClick={() => mergeInto(t.tag, open.value)}
                      >
                        Merge
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="tag-row-actions">
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing({ tag: t.tag, mode: 'rename', value: t.tag })}>Rename</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy || tags.length < 2} onClick={() => setEditing({ tag: t.tag, mode: 'merge', value: '' })}>Merge</button>
                      <button type="button" className="btn btn-ghost btn-sm tag-delete" disabled={busy} onClick={() => remove(t.tag)}>Delete</button>
                    </div>
                  )}
                </li>
              );
            })}
            {shown.length === 0 ? <li className="qb-card-panel-empty">No tag matches “{find.trim()}”.</li> : null}
          </ul>
        </>
      )}
    </section>
  );
}
