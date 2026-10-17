// app/(app)/admin/question-reports/page.tsx — Question reports (06.2;
// Sam, 2026-10-17). New, built from the plan. Two tabs: Open — a quiet
// list of the questions students have reported, most reports first, each
// opening in place onto the whole question with Mark fixed and Dismiss —
// and Closed, read only: what was fixed or dismissed, by whom and when,
// newest first. Twenty a page. The database groups and pages
// (question_report_groups()); the page reads no report row itself.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { getReportGroups } from '@/lib/question-reports/queries';
import { REPORT_GROUPS_PER_PAGE, type ReportView } from '@/lib/question-reports/types';
import { ReportsList } from './reports-list';
import '@/styles/admin-question-reports.css';

export const metadata: Metadata = {
  title: 'Question Reports | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

type Search = Promise<{ view?: string; page?: string }>;

const BASE = '/admin/question-reports';

function hrefFor(view: ReportView, page = 1): string {
  const q = new URLSearchParams();
  if (view === 'closed') q.set('view', 'closed');
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `${BASE}?${s}` : BASE;
}

function subtitle(view: ReportView, total: number): string {
  if (view === 'closed') return total ? `${total} closed — fixed or dismissed, newest first` : 'Fixed and dismissed reports';
  return total ? `${total} question${total === 1 ? '' : 's'} with open reports` : 'Mistakes students have reported, one line per question';
}

export default async function AdminQuestionReportsPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const params = await searchParams;
  const view: ReportView = params.view === 'closed' ? 'closed' : 'open';
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const result = await getReportGroups(view, page);
  const pages = result.ok ? Math.max(1, Math.ceil(result.total / REPORT_GROUPS_PER_PAGE)) : 1;

  return (
    <div className="aqr">
      <PageHeader title="Question Reports" subtitle={subtitle(view, result.ok ? result.total : 0)} />
      <nav className="aqr-tabs" aria-label="Reports">
        {(['open', 'closed'] as const).map((v) =>
          v === view ? (
            <span key={v} className="aqr-tab aqr-tab-on" aria-current="page">{v === 'open' ? 'Open' : 'Closed'}</span>
          ) : (
            <AppLink key={v} href={hrefFor(v)} className="aqr-tab">{v === 'open' ? 'Open' : 'Closed'}</AppLink>
          ),
        )}
      </nav>
      {!result.ok ? (
        <div className="card aqr-empty">Could not load the reports. Please refresh the page.</div>
      ) : result.groups.length === 0 ? (
        <div className="card aqr-empty">
          {page > 1
            ? 'Nothing on this page.'
            : view === 'closed'
              ? 'Nothing closed yet. A question marked fixed or dismissed shows here.'
              : 'No open reports. When a student reports an issue with a question, it shows here.'}
        </div>
      ) : (
        <ReportsList groups={result.groups} view={view} />
      )}
      {result.ok && pages > 1 ? (
        <nav className="aqr-pager" aria-label="Pages">
          {page > 1 ? <AppLink href={hrefFor(view, page - 1)} className="btn btn-ghost">Previous</AppLink> : <span />}
          <span className="aqr-pager-at">Page {page} of {pages}</span>
          {page < pages ? <AppLink href={hrefFor(view, page + 1)} className="btn btn-ghost">Next</AppLink> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
