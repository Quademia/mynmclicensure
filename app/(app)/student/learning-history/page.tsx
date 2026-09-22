// app/(app)/student/learning-history/page.tsx — legacy student/learning-history.html.
//
// The server half (slice 7a): the gate, then what legacy's initPage
// loaded — the course access map and the active courses (the enrolled
// ones are those the map covers), and the first page of attempts, with
// the `?course=` pre-filter applied when it names an enrolled course —
// handed to the client half, which is the page's script. Every later
// page (a filter change, Load more) goes through a Server Action.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getStudentAttemptsPaginated } from '@/lib/attempts/queries';
import { PageHeader } from '@/components/shell/page-header';
import { LearningHistoryClient } from './learning-history-client';
import '@/styles/student-learning-history.css';

export const metadata: Metadata = {
  title: 'Learning History | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function LearningHistoryPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { course } = await searchParams;

  const [access, allCourses] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
  ]);
  const enrolled = allCourses.filter((c) => Boolean(access[c.course_id])).map((c) => ({ course_id: c.course_id, title: c.title }));

  // legacy: the chip and the Course filter follow ?course= only when it
  // names an enrolled course.
  const urlCourse = String(course || '');
  const initialCourseId = urlCourse && enrolled.some((c) => c.course_id === urlCourse) ? urlCourse : '';

  const firstPage = await getStudentAttemptsPaginated(
    supabase,
    profile.user_id,
    { courseId: initialCourseId, status: '', mode: '', search: '' },
    0,
  );

  return (
    <>
      <PageHeader title="Learning History" subtitle="All your quiz attempts across courses" />
      <LearningHistoryClient courses={enrolled} initialCourseId={initialCourseId} initialPage={firstPage} />
    </>
  );
}
