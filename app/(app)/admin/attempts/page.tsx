// app/(app)/admin/attempts/page.tsx — legacy admin/attempts.html
// (slice 14b; the page as built 2026-06-04).
//
// The server half: the gate, then the reference maps legacy's initPage
// loaded once — every course (the Course filter and the course names)
// and every fixed quiz and mock exam (the titles). The counts and the
// window are loaded by the client after mount, on the admin's own
// clock, through Server Actions.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAllCourses } from '@/lib/catalogue/queries';
import { getAllQuizzes } from '@/lib/quizzes/queries';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { AttemptsClient } from './attempts-client';
import '@/styles/admin-attempts.css';

export const metadata: Metadata = {
  title: 'Attempts | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminAttemptsPage() {
  const { supabase, profile } = await requireAdmin();
  const serviceDb = createServiceRoleClient(); // full quiz rows (Q1)

  const [courses, fixed, mocks] = await Promise.all([
    getAllCourses(supabase),
    getAllQuizzes(serviceDb, 'fixed'),
    getAllQuizzes(serviceDb, 'mock'),
  ]);

  const quizTitles: Record<string, string> = {};
  for (const q of fixed) quizTitles[q.quiz_id] = q.title;
  for (const q of mocks) quizTitles[q.quiz_id] = q.title;

  return (
    <>
      <PageHeader title="Attempts" subtitle="See and analyse students' quiz & exam attempts" userName={displayNameOf(profile)} />
      <AttemptsClient courses={courses.map((c) => ({ course_id: c.course_id, title: c.title }))} quizTitles={quizTitles} />
    </>
  );
}
