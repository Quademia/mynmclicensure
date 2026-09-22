// app/(app)/student/fixed-quizzes/page.tsx — legacy student/fixed-quizzes.html.
//
// The server half: the gate, then what legacy's initPage loaded — the
// student's course access and the active courses (the enrolled ones are
// those the access map covers), and for each enrolled course its
// published, active quizzes and the student's attempts — handed to the
// shared client half, which is the page's script. The `?course=` the
// course page passes becomes the filter chip.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getQuizzesForCourse } from '@/lib/quizzes/queries';
import { getStudentAttempts } from '@/lib/attempts/queries';
import type { QuizCard } from '@/lib/quizzes/types';
import type { AttemptWithProgress } from '@/lib/attempts/types';
import { PageHeader } from '@/components/shell/page-header';
import { StudentQuizList } from '@/components/quizzes/student-quiz-list';
import '@/styles/student-quizzes.css';

export const metadata: Metadata = {
  title: 'Fixed Quizzes | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentFixedQuizzesPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { course } = await searchParams;

  const [access, allCourses] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
  ]);
  const enrolled = allCourses.filter((c) => Boolean(access[c.course_id])).map((c) => ({ course_id: c.course_id, title: c.title }));

  const quizzesByCourse: Record<string, QuizCard[]> = {};
  const attemptsByCourse: Record<string, AttemptWithProgress[]> = {};
  await Promise.all(
    enrolled.map(async (c) => {
      const [quizzes, attempts] = await Promise.all([
        getQuizzesForCourse(supabase, 'fixed', c.course_id),
        getStudentAttempts(supabase, profile.user_id, c.course_id),
      ]);
      quizzesByCourse[c.course_id] = quizzes;
      attemptsByCourse[c.course_id] = attempts;
    }),
  );

  return (
    <>
      <PageHeader title="Fixed Quizzes" subtitle="Pre-built quizzes organised by course" />
      <StudentQuizList
        kind="fixed"
        courses={enrolled}
        quizzesByCourse={quizzesByCourse}
        attemptsByCourse={attemptsByCourse}
        activeCourseFilter={String(course || '') || null}
        serverNow={new Date().toISOString()}
      />
    </>
  );
}
