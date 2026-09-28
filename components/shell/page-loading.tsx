// components/shell/page-loading.tsx
//
// The one loading placeholder (Sam, 2026-09-28: "a common loading screen
// to use through out the app", for students on slow connections). A
// route's loading.tsx renders it, and Next shows it the moment a link is
// tapped — prefetched ahead of the tap on a production build — until the
// real page arrives in its place. Two shapes:
//
//   - framed: inside the app shell's <main>, so the top bar and the
//     menu stay put — a title, its subtitle and three card shapes;
//   - bare: for the two pages with no shell (the quiz screen and the
//     printable offline pack) — one card shape on its own.
//
// Grey shapes only, no pictures, so it arrives on a weak signal. Screen
// readers hear "Loading…"; the pulse rests for anyone who has turned
// motion off. Server Component. Its partner for the tap itself is
// link-pending.tsx.

import '@/styles/loading.css';

export function PageLoading({ bare = false }: { bare?: boolean }) {
  return (
    <div className={bare ? 'page-loading page-loading-bare' : 'page-loading'} role="status" aria-live="polite">
      <span className="page-loading-label">Loading…</span>
      {bare ? (
        <div className="pl-card pl-card-alone" aria-hidden="true">
          <div className="pl-bone pl-line-short" />
          <div className="pl-bone pl-line-title" />
          <div className="pl-bone pl-line" />
          <div className="pl-bone pl-line pl-line-mid" />
          <div className="pl-bone pl-button" />
        </div>
      ) : (
        <div aria-hidden="true">
          <div className="pl-head">
            <div className="pl-bone pl-title" />
            <div className="pl-bone pl-subtitle" />
          </div>
          <div className="pl-card">
            <div className="pl-bone pl-line-short" />
            <div className="pl-bone pl-line" />
            <div className="pl-bone pl-line pl-line-mid" />
          </div>
          <div className="pl-card">
            <div className="pl-bone pl-line-short" />
            <div className="pl-bone pl-line" />
          </div>
          <div className="pl-card">
            <div className="pl-bone pl-line-short" />
            <div className="pl-bone pl-line pl-line-mid" />
          </div>
        </div>
      )}
    </div>
  );
}
