// app/(app)/admin/mock-exams/page.tsx — legacy admin/mock-exams.html.
//
// The server half: the gate, then the two lists the page loaded on init —
// every course, archived included, for the dropdowns (legacy
// getAllCourses) and every mock exam, whole (legacy getAllMockQuizzes) —
// handed to the shared four-pane component, which is the page's script.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllCourses } from '@/lib/catalogue/queries';
import { getAllQuizzesPaginated } from '@/lib/quizzes/queries';
import { PageHeader } from '@/components/shell/page-header';
import { QuizManager } from '@/components/quizzes/quiz-manager';
import '@/styles/admin-quizzes.css';

export const metadata: Metadata = {
  title: 'Mock Exams | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminMockExamsPage() {
  const { supabase } = await requireAdmin();
  // The first page of fifty with an exact count, like the fixed list
  // (Q2, D45 f) — legacy loaded the whole table and reported its length.
  const [courses, first] = await Promise.all([getAllCourses(supabase), getAllQuizzesPaginated(supabase, 'mock', '', 0, 50)]);

  return (
    <>
      <PageHeader
        title="Mock Exams"
        subtitle="Create and manage mock exams for exam periods"
      />
      <QuizManager kind="mock" courses={courses} initialRows={first.quizzes} initialTotal={first.total} />
    </>
  );
}
