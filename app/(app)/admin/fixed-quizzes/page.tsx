// app/(app)/admin/fixed-quizzes/page.tsx — legacy admin/fixed-quizzes.html.
//
// The server half: the gate, then the two lists the page loaded on init —
// every course, archived included, for the dropdowns (legacy
// getAllCourses) and the first page of quizzes (legacy loadQuizList:
// fifty, newest first) — handed to the shared four-pane component, which
// is the page's script. Everything after that goes through Server
// Actions, as legacy fetched on demand.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllCourses } from '@/lib/catalogue/queries';
import { getAllQuizzesPaginated } from '@/lib/quizzes/queries';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { QuizManager } from '@/components/quizzes/quiz-manager';
import '@/styles/admin-quizzes.css';

export const metadata: Metadata = {
  title: 'Fixed Quizzes | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminFixedQuizzesPage() {
  const { supabase, profile } = await requireAdmin();
  const [courses, first] = await Promise.all([
    getAllCourses(supabase),
    getAllQuizzesPaginated(supabase, '', 0, 50),
  ]);

  return (
    <>
      <PageHeader
        title="Fixed Quizzes"
        subtitle="Build and manage pre-set quiz assessments for all courses"
        userName={displayNameOf(profile)}
      />
      <QuizManager kind="fixed" courses={courses} initialRows={first.quizzes} initialTotal={first.total} />
    </>
  );
}
