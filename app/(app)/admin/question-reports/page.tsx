// app/(app)/admin/question-reports/page.tsx — Question reports (06.2;
// Sam, 2026-10-17). New, built from the plan: one card per question that
// students have reported, newest first, twenty a page — how many reports,
// their reasons, the newest date, the reports themselves, a link into the
// bank's editor, and Mark fixed or Dismiss for all of its open reports.
// The database groups and pages (question_report_groups()); the page
// reads no report row itself.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { getReportGroups } from '@/lib/question-reports/queries';
import { REPORT_GROUPS_PER_PAGE } from '@/lib/question-reports/types';
import { ReportsList } from './reports-list';
import '@/styles/admin-question-reports.css';

export const metadata: Metadata = {
  title: 'Question Reports | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

type Search = Promise<{ page?: string }>;

export default async function AdminQuestionReportsPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  const result = await getReportGroups(page);
  const pages = result.ok ? Math.max(1, Math.ceil(result.total / REPORT_GROUPS_PER_PAGE)) : 1;

  return (
    <div className="aqr">
      <PageHeader
        title="Question Reports"
        subtitle={result.ok && result.total ? `${result.total} question${result.total === 1 ? '' : 's'} with open reports` : 'Mistakes students have reported, one card per question'}
      />
      {!result.ok ? (
        <div className="card aqr-empty">Could not load the reports. Please refresh the page.</div>
      ) : result.groups.length === 0 ? (
        <div className="card aqr-empty">
          {page > 1 ? 'No reports on this page.' : 'No open reports. When a student reports an issue with a question, it shows here.'}
        </div>
      ) : (
        <ReportsList groups={result.groups} />
      )}
      {result.ok && pages > 1 ? (
        <nav className="aqr-pager" aria-label="Pages">
          {page > 1 ? <AppLink href={`/admin/question-reports?page=${page - 1}`} className="btn btn-ghost">Newer</AppLink> : <span />}
          <span className="aqr-pager-at">Page {page} of {pages}</span>
          {page < pages ? <AppLink href={`/admin/question-reports?page=${page + 1}`} className="btn btn-ghost">Older</AppLink> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
