// app/(app)/admin/mock-exams/page.tsx — legacy admin/mock-exams.html.
//
// The server half: the gate, then the two lists the page loaded on init —
// every course, archived included, for the dropdowns (legacy
// getAllCourses) and every mock exam, whole (legacy getAllMockQuizzes) —
// handed to the shared four-pane component, which is the page's script.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAllCourses } from '@/lib/catalogue/queries';
import { getAllQuizzes } from '@/lib/quizzes/queries';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { QuizManager } from '@/components/quizzes/quiz-manager';
import '@/styles/admin-quizzes.css';

export const metadata: Metadata = {
  title: 'Mock Exams | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminMockExamsPage() {
  const { supabase, profile } = await requireAdmin();
  // Full rows (item_ids, notes) through the service role since Q1.
  const [courses, mocks] = await Promise.all([getAllCourses(supabase), getAllQuizzes(createServiceRoleClient(), 'mock')]);

  return (
    <>
      <PageHeader
        title="Mock Exams"
        subtitle="Create and manage mock exams for exam periods"
        userName={displayNameOf(profile)}
      />
      <QuizManager kind="mock" courses={courses} initialRows={mocks} initialTotal={mocks.length} />
    </>
  );
}
