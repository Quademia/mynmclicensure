// app/(app)/student/learning-history/history-list.tsx — the list's own
// half (05.5; Sam, 2026-10-17): the rows as the server worded them, Load
// more, and the three dots' two actions, Retake and Abandon.
//
// A row is one tap: to its report, or into the sitting to Resume; an
// abandoned row, or one locked without a package, opens nothing. The dots
// (RowMenu, 09.10) hold the rest. Retake and Abandon are Server Actions:
// while one runs the row says "Starting…" or "Abandoning…" in place of its
// score; a dropped connection gives the row back with a toast (AGENTS.md:
// an action whose request fails rejects). Abandon asks first, in the
// paper page's words (04.20), then refreshes the page — the list keys on
// the server's render, so it starts again from the fresh first page.

'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { abandonAttempt, retakeAttempt } from '@/lib/attempts/actions';
import { sessionHref } from '@/lib/attempts/links';
import { loadMoreHistory } from '@/lib/history/actions';
import type { HistoryChunk, HistoryMenuLine, HistoryRow } from '@/lib/history/types';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';
import { Toast } from '@/lib/toast/toast';
import { LinkPending } from '@/components/shell/link-pending';
import { RowMenu, type RowMenuItem } from '@/components/shell/row-menu';

const PACKAGE_HREF = '/student/upgrade';

type Msg = { text: string; tone: 'error' | 'success' } | null;
type Busy = { attemptId: string; word: string } | null;

export function HistoryList({ courseId, first }: { courseId: string; first: HistoryChunk }) {
  const router = useRouter();
  const [rows, setRows] = useState<HistoryRow[]>(first.rows);
  const [total, setTotal] = useState(first.total);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const clearMsg = useCallback(() => setMsg(null), []);
  const [confirm, confirmDialog] = useConfirm();

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const next = await loadMoreHistory(courseId, page + 1);
      setRows((prev) => prev.concat(next.rows.filter((r) => !prev.some((p) => p.attemptId === r.attemptId))));
      setTotal(next.total);
      setPage(page + 1);
    } catch {
      setMsg({ text: 'Could not load more. Please check your connection and try again.', tone: 'error' });
    }
    setLoading(false);
  }

  async function retake(row: HistoryRow) {
    if (busy) return;
    setBusy({ attemptId: row.attemptId, word: 'Starting…' });
    try {
      const result = await retakeAttempt(row.attemptId);
      if (!result.ok) {
        setBusy(null);
        setMsg({ text: `Could not start the retake. ${result.error || 'Please try again.'}`.trim(), tone: 'error' });
        return;
      }
      router.push(sessionHref(result.attemptId));
    } catch {
      setBusy(null);
      setMsg({ text: 'Could not start the retake. Please check your connection and try again.', tone: 'error' });
    }
  }

  async function abandon(row: HistoryRow, sittingsAllowed: number | null) {
    if (busy) return;
    const ok = await confirm({
      title: 'Abandon this sitting?',
      body:
        "It won't be scored, and you can start a new one." +
        (sittingsAllowed != null ? ` It still counts as one of your ${sittingsAllowed} sittings.` : ''),
      confirmLabel: 'Abandon sitting',
      cancelLabel: 'Keep going',
      danger: true,
    });
    if (!ok) return;
    setBusy({ attemptId: row.attemptId, word: 'Abandoning…' });
    try {
      const result = await abandonAttempt(row.attemptId);
      if (!result.ok) {
        setBusy(null);
        setMsg({ text: result.error || 'Could not abandon. Please try again.', tone: 'error' });
        return;
      }
      router.refresh();
    } catch {
      setBusy(null);
      setMsg({ text: 'Could not abandon. Please check your connection and try again.', tone: 'error' });
    }
  }

  function menuOf(row: HistoryRow): RowMenuItem[] {
    return row.menu.map((line: HistoryMenuLine): RowMenuItem => {
      switch (line.kind) {
        case 'resume':
          return { type: 'link', label: 'Resume', href: line.href, icon: 'play' };
        case 'abandon':
          return { type: 'button', label: 'Abandon this sitting', icon: 'x', danger: true, onSelect: () => void abandon(row, line.sittingsAllowed) };
        case 'report':
          return { type: 'link', label: 'See your report', href: line.href, icon: 'chart' };
        case 'review':
          return { type: 'link', label: 'Review answers', href: line.href, icon: 'book-open' };
        case 'retake':
          return { type: 'button', label: 'Retake', icon: 'refresh', onSelect: () => void retake(row) };
        case 'note':
          return { type: 'note', label: line.text, icon: line.icon };
        case 'locked':
          return { type: 'locked', label: line.label };
      }
    });
  }

  return (
    <>
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={clearMsg} />
      {confirmDialog}

      <div className="card lh-list">
        {rows.map((row) => (
          <div key={row.attemptId} className="lh-row">
            <RowBody row={row} busyWord={busy?.attemptId === row.attemptId ? busy.word : null} />
            <RowMenu label={`More for ${row.name}`} items={menuOf(row)} lockedHref={PACKAGE_HREF} />
          </div>
        ))}
      </div>

      {rows.length < total ? (
        <div className="lh-more">
          <button type="button" className="btn btn-ghost btn-lg" disabled={loading} onClick={() => void loadMore()}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </>
  );
}

function RowBody({ row, busyWord }: { row: HistoryRow; busyWord: string | null }) {
  const meta = [row.courseTitle, row.modeName, row.day].filter(Boolean).join(' · ');
  const inner = (
    <>
      <span className="lh-row-text">
        <span className="lh-name">{row.name}</span>
        <span className="lh-meta">{meta}</span>
      </span>
      <span className="lh-right">{busyWord ? <span className="lh-word">{busyWord}</span> : <Right row={row} />}</span>
    </>
  );
  if (!row.href) return <div className="lh-row-main">{inner}</div>;
  return (
    <Link href={row.href} className="lh-row-main">
      {inner}
      <LinkPending />
    </Link>
  );
}

function Right({ row }: { row: HistoryRow }) {
  const r = row.right;
  if (r.kind === 'score') return <span className="lh-score">{r.pct}%</span>;
  if (r.kind === 'resume') return <span className="btn btn-primary btn-sm lh-resume">Resume</span>;
  if (r.kind === 'held') return <span className="lh-pill">{r.text}</span>;
  return <span className="lh-pill">Abandoned</span>;
}
