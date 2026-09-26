// app/(app)/admin/question-bank/subjects-topics-panel.tsx
//
// The Subjects & topics panel (08 B5, §8 S18 as amended by Sam,
// 2026-09-26): the picked course's two lists side by side, each word with
// how many questions carry it, and a line for the questions whose word is
// Not set. Per word: rename (the database carries the new word to every
// question), merge (its questions move to another word, then it goes),
// retire / restore (a retired word leaves the editor's dropdown and stays
// on the questions that have it), delete (refused while any question uses
// it); on a topic holding a "/", split (one part stays the topic, the
// others become tags). Merge and split move questions and cannot be
// undone, so both ask first in the app's dialog. This is where the
// clean-up of the words happens, at Sam's pace. A card on the page, as
// Tags is; beside its one caller (folder convention #3).

'use client';

import { useEffect, useState } from 'react';
import {
  addListEntry,
  deleteListEntry,
  loadListPanel,
  mergeListEntries,
  renameListEntry,
  setListEntryRetired,
  splitTopic,
} from '@/lib/bank/actions';
import type { ListChangeResult, ListKind, ListPanelResult, PanelEntry } from '@/lib/bank/types';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

type Notify = (text: string, tone: 'error' | 'success') => void;
type Editing = { kind: ListKind; id: number; mode: 'rename' | 'merge' | 'split'; value: string } | null;

const questions = (n: number) => `${n} question${n === 1 ? '' : 's'}`;
const sameWord = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
const splitParts = (name: string) => name.split('/').map((p) => p.trim().replace(/\s+/g, ' ')).filter(Boolean);

export function SubjectsTopicsPanel({
  courseId,
  courseTitle,
  onClose,
  onChanged,
  notify,
}: {
  courseId: string;
  courseTitle: string;
  onClose: () => void;
  /** After a change: the page re-reads the course so the cards and the editor show it. */
  onChanged: () => Promise<void> | void;
  notify: Notify;
}) {
  const [result, setResult] = useState<ListPanelResult | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [adding, setAdding] = useState<Record<ListKind, string>>({ subject: '', topic: '' });
  const [find, setFind] = useState<Record<ListKind, string>>({ subject: '', topic: '' });
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    let live = true;
    loadListPanel(courseId).then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, [courseId]);

  const listOf = (kind: ListKind): PanelEntry[] => (result?.ok ? (kind === 'subject' ? result.subjects : result.topics) : []);

  async function run(action: Promise<ListChangeResult>, done: (n: number) => string) {
    setBusy(true);
    try {
      const r = await action;
      if (!r.ok) return notify(r.error, 'error');
      notify(done(r.changed), 'success');
      setEditing(null);
      // the page re-reads the course, which remounts this panel with
      // fresh counts (its key carries the read count)
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function add(kind: ListKind) {
    const name = adding[kind].trim();
    if (!name) return notify(`Please enter the ${kind}.`, 'error');
    await run(addListEntry(kind, courseId, name), () => `“${name}” added to the ${kind} list.`);
    setAdding((a) => ({ ...a, [kind]: '' }));
  }

  async function merge(kind: ListKind, from: PanelEntry, into: PanelEntry) {
    const ok = await confirm({
      title: `Merge “${from.name}” into “${into.name}”?`,
      body: `The ${questions(from.count)} with the ${kind} “${from.name}” will carry “${into.name}” instead, and “${from.name}” leaves the list. This cannot be undone.`,
      confirmLabel: `Merge ${kind}s`,
      danger: true,
    });
    if (!ok) return;
    await run(mergeListEntries(kind, courseId, from.id, into.id), (n) => `“${from.name}” merged into “${into.name}” — ${questions(n)} moved.`);
  }

  async function rename(kind: ListKind, entry: PanelEntry, value: string) {
    const name = value.trim().replace(/\s+/g, ' ');
    if (!name) return notify('Please enter the new name.', 'error');
    if (name === entry.name) return setEditing(null);
    // onto a word already on the list: that is a merge, and it asks first
    const twin = listOf(kind).find((e) => e.id !== entry.id && sameWord(e.name, name));
    if (twin) return merge(kind, entry, twin);
    await run(renameListEntry(kind, courseId, entry.id, name), (n) => `“${entry.name}” renamed to “${name}” on ${questions(n)}.`);
  }

  async function split(entry: PanelEntry, keep: string) {
    const others = splitParts(entry.name).filter((p) => p !== keep);
    const ok = await confirm({
      title: `Split “${entry.name}”?`,
      body: `Its ${questions(entry.count)} take the topic “${keep}”, and gain the tag${others.length === 1 ? '' : 's'} ${others.map((o) => `“${o}”`).join(', ')}. “${entry.name}” leaves the list. This cannot be undone.`,
      confirmLabel: 'Split topic',
      danger: true,
    });
    if (!ok) return;
    await run(splitTopic(courseId, entry.id, keep), (n) => `“${entry.name}” split — ${questions(n)} now on “${keep}”.`);
  }

  async function remove(kind: ListKind, entry: PanelEntry) {
    if (entry.count) {
      return notify(`${questions(entry.count)} still ${entry.count === 1 ? 'uses' : 'use'} “${entry.name}” — merge it into another ${kind}, or retire it.`, 'error');
    }
    const ok = await confirm({
      title: `Delete “${entry.name}” from the ${kind} list?`,
      body: 'No question carries it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await run(deleteListEntry(kind, courseId, entry.id), () => `“${entry.name}” deleted from the ${kind} list.`);
  }

  function column(kind: ListKind, heading: string) {
    const all = listOf(kind);
    const q = find[kind].trim().toLowerCase();
    const shown = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
    const notSet = result?.ok ? result.notSet[kind] : 0;
    return (
      <div className="lists-col">
        <div className="lists-col-head">
          <h4>{heading} <span className="muted">· {all.length}</span></h4>
          <span className="lists-notset">{notSet ? `${questions(notSet)} not set` : 'none not set'}</span>
        </div>

        <form
          className="lists-add"
          onSubmit={(e) => {
            e.preventDefault();
            add(kind);
          }}
        >
          <input
            type="text"
            aria-label={`New ${kind}`}
            placeholder={`Add a ${kind}…`}
            value={adding[kind]}
            onChange={(e) => setAdding((a) => ({ ...a, [kind]: e.target.value }))}
          />
          <button type="submit" className="btn btn-ghost btn-sm" disabled={busy || !adding[kind].trim()}>Add</button>
        </form>

        {all.length > 8 ? (
          <input
            type="text"
            className="qb-card-panel-find"
            aria-label={`Find a ${kind}`}
            placeholder={`Find among ${all.length}…`}
            value={find[kind]}
            onChange={(e) => setFind((f) => ({ ...f, [kind]: e.target.value }))}
          />
        ) : null}

        {all.length === 0 ? (
          <p className="qb-card-panel-empty">No {kind}s on this course&rsquo;s list yet.</p>
        ) : (
          <ul className="tag-list">
            {shown.map((entry) => {
              const open = editing && editing.kind === kind && editing.id === entry.id ? editing : null;
              const canSplit = kind === 'topic' && splitParts(entry.name).length > 1;
              return (
                <li key={entry.id} className={`tag-row${entry.retired ? ' is-retired' : ''}`}>
                  <div className="tag-row-main">
                    <span className="tag-chip">{entry.name}</span>
                    {entry.retired ? <span className="badge badge-neutral">Retired</span> : null}
                    <span className="tag-count">{questions(entry.count)}</span>
                  </div>

                  {open?.mode === 'rename' ? (
                    <form
                      className="tag-row-edit"
                      onSubmit={(e) => {
                        e.preventDefault();
                        rename(kind, entry, open.value);
                      }}
                    >
                      <input type="text" aria-label={`New name for ${entry.name}`} value={open.value} autoFocus onChange={(e) => setEditing({ ...open, value: e.target.value })} />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Save</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : open?.mode === 'merge' ? (
                    <div className="tag-row-edit">
                      <select aria-label={`Merge ${entry.name} into`} value={open.value} onChange={(e) => setEditing({ ...open, value: e.target.value })}>
                        <option value="">Merge into…</option>
                        {all.filter((o) => o.id !== entry.id).map((o) => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy || !open.value}
                        onClick={() => {
                          const into = all.find((o) => String(o.id) === open.value);
                          if (into) merge(kind, entry, into);
                        }}
                      >
                        Merge
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : open?.mode === 'split' ? (
                    <div className="tag-row-edit">
                      <select aria-label={`Topic to keep from ${entry.name}`} value={open.value} onChange={(e) => setEditing({ ...open, value: e.target.value })}>
                        {splitParts(entry.name).map((p) => <option key={p} value={p}>Keep “{p}” as the topic</option>)}
                      </select>
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy || !open.value} onClick={() => split(entry, open.value)}>Split</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="tag-row-actions">
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing({ kind, id: entry.id, mode: 'rename', value: entry.name })}>Rename</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy || all.length < 2} onClick={() => setEditing({ kind, id: entry.id, mode: 'merge', value: '' })}>Merge</button>
                      {canSplit ? (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing({ kind, id: entry.id, mode: 'split', value: splitParts(entry.name)[0] })}>Split</button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() =>
                          run(setListEntryRetired(kind, courseId, entry.id, !entry.retired), () =>
                            entry.retired ? `“${entry.name}” restored.` : `“${entry.name}” retired — it stays on its questions and leaves the dropdown.`,
                          )
                        }
                      >
                        {entry.retired ? 'Restore' : 'Retire'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm tag-delete" disabled={busy} onClick={() => remove(kind, entry)}>Delete</button>
                    </div>
                  )}
                </li>
              );
            })}
            {shown.length === 0 ? <li className="qb-card-panel-empty">No {kind} matches “{find[kind].trim()}”.</li> : null}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section className="qb-card-panel" aria-labelledby="qbListsTitle">
      {confirmDialog}
      <div className="qb-card-panel-head">
        <h3 id="qbListsTitle">Subjects &amp; topics — {courseTitle}</h3>
        <button type="button" className="panel-close" onClick={onClose} title="Close">✕</button>
      </div>
      <p className="qb-card-panel-note">
        This course&rsquo;s two lists. A question&rsquo;s subject and topic must be on them, or Not set. A rename reaches every question carrying the word; merge and split move questions and cannot be undone.
      </p>
      {result === null ? (
        <p className="qb-card-panel-empty">Loading the lists…</p>
      ) : !result.ok ? (
        <p className="qb-card-panel-empty">{result.error}</p>
      ) : (
        <div className="lists-grid">
          {column('subject', 'Subjects')}
          {column('topic', 'Topics')}
        </div>
      )}
    </section>
  );
}
