// app/(app)/admin/question-bank/free-pool-panel.tsx
//
// The Free pool panel (08 B4): how many free questions each programme
// has, with the courses beneath. A course in several programmes counts
// under each — General Paper is in all five — so the programme figures
// overlap rather than add up, and the panel says so in one line. Only a
// published free question is in a pool; drafts marked free are shown
// beside their course. The pool's door to students is 09 F1, not built,
// which the note says too. Read-only; beside its one caller.

'use client';

import { useEffect, useState } from 'react';
import { loadFreePool } from '@/lib/bank/actions';
import type { FreePoolResult } from '@/lib/bank/types';

const free = (n: number) => `${n} free`;

export function FreePoolPanel({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<FreePoolResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let live = true;
    loadFreePool().then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    setResult(await loadFreePool());
    setRefreshing(false);
  }

  return (
    <section className="qb-card-panel" aria-labelledby="qbFreeTitle">
      <div className="qb-card-panel-head">
        <h3 id="qbFreeTitle">Free pool</h3>
        <div className="qb-card-panel-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" disabled={refreshing || result === null} onClick={refresh}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="panel-close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>
      <p className="qb-card-panel-note">
        Published questions marked free, per programme. A course in several programmes counts under each — General Paper is in all five — so these figures overlap and do not add up. The pool is not open to students yet.
      </p>

      {result === null ? (
        <p className="qb-card-panel-empty">Counting…</p>
      ) : !result.ok ? (
        <p className="qb-card-panel-empty">{result.error}</p>
      ) : (
        <>
          <p className="pool-total">
            <strong>{result.totalFree}</strong> free question{result.totalFree === 1 ? '' : 's'} in the bank in all.
          </p>
          <div className="pool-grid">
            {result.programmes.map((p) => (
              <div key={p.programId} className="pool-prog">
                <div className="pool-prog-head">
                  <span className="pool-prog-name">{p.name}</span>
                  <span className="pool-prog-count">{free(p.free)}</span>
                </div>
                {p.courses.length === 0 ? (
                  <p className="pool-course muted">No courses in this programme.</p>
                ) : (
                  <ul>
                    {p.courses.map((c) => (
                      <li key={c.courseId} className="pool-course">
                        <span>
                          {c.title} <span className="muted">({c.courseId}){c.archived ? ' · archived' : ''}</span>
                        </span>
                        <span className="pool-course-count">
                          {free(c.free)}
                          {c.freeDrafts ? <span className="muted"> · {c.freeDrafts} draft{c.freeDrafts === 1 ? '' : 's'} marked free</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
