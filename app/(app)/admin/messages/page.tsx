// app/(app)/admin/messages/page.tsx — the admin's Messages, a list of
// students (08.2 step 4; Sam, 2026-10-17). One row per student — the
// students waiting for a reply first, the longest waiting at the top —
// each opening onto that student's Messages as they see them
// (./[user_id]). Search reaches every student, so one who never wrote can
// be found and written to; "Waiting for a reply / All" and the label
// narrow the list. Twenty a page, grouped and paged in the database.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { filtersFrom, getStudentsList, STUDENTS_PER_PAGE, type StudentsFilters } from '@/lib/messaging/admin-students';
import { StudentsFiltersBar } from './students-filters';
import '@/styles/admin-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

type Search = Promise<{ q?: string; view?: string; label?: string; page?: string }>;

function hrefFor(f: StudentsFilters, page: number): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.view === 'all') p.set('view', 'all');
  if (f.label) p.set('label', f.label);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return s ? `/admin/messages?${s}` : '/admin/messages';
}

export default async function AdminMessagesPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const f = filtersFrom(await searchParams);
  const result = await getStudentsList(f);
  const pages = result.ok ? Math.max(1, Math.ceil(result.total / STUDENTS_PER_PAGE)) : 1;

  const subtitle = !result.ok
    ? undefined
    : f.view === 'waiting'
      ? result.total
        ? `${result.total} student${result.total === 1 ? '' : 's'} waiting for a reply`
        : 'Nobody is waiting for a reply'
      : `${result.total} student${result.total === 1 ? '' : 's'}`;

  return (
    <div className="amsg">
      <PageHeader title="Messages" subtitle={subtitle} />
      <StudentsFiltersBar q={f.q} view={f.view} label={f.label} />

      {!result.ok ? (
        <div className="card amsg-empty">Could not load the messages. Please refresh the page.</div>
      ) : result.rows.length === 0 ? (
        <div className="card amsg-empty">
          {f.q ? 'No student matches that search.' : f.view === 'waiting' ? 'Nobody is waiting for a reply. Switch to All to see every conversation.' : 'No messages yet.'}
        </div>
      ) : (
        <ul className="card amsg-list">
          {result.rows.map((r) => (
            <li key={r.user_id}>
              <AppLink href={`/admin/messages/${encodeURIComponent(r.user_id)}`} className={`amsg-row${r.waiting ? ' is-waiting' : ''}`}>
                <span className="amsg-dot" aria-label={r.waiting ? 'Waiting for a reply' : undefined} />
                <span className="amsg-main">
                  <span className="amsg-name">
                    {r.name}
                    {r.programme ? <span className="amsg-prog"> · {r.programme}</span> : null}
                  </span>
                  <span className="amsg-sub">
                    {r.waitingWhat.length ? <span className="amsg-what">{r.waitingWhat.join(', ')}</span> : null}
                    {r.waitingWhat.length && r.preview ? ' — ' : null}
                    {r.preview ? (r.fromStudent ? r.preview : `You: ${r.preview}`) : r.lastAt ? null : 'No messages yet — open to write'}
                  </span>
                </span>
                <span className="amsg-when">{r.when}</span>
              </AppLink>
            </li>
          ))}
        </ul>
      )}

      {result.ok && pages > 1 ? (
        <nav className="amsg-pager" aria-label="Pages">
          {f.page > 1 ? <AppLink href={hrefFor(f, f.page - 1)} className="btn btn-ghost">Previous</AppLink> : <span />}
          <span className="amsg-pager-at">Page {f.page} of {pages}</span>
          {f.page < pages ? <AppLink href={hrefFor(f, f.page + 1)} className="btn btn-ghost">Next</AppLink> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
