// app/(app)/student/mock-exams/page.tsx — legacy student/mock-exams.html.
//
// The server half, the same shape as fixed-quizzes/page.tsx: the gate,
// the enrolled courses, each course's published, active mock exams and
// the student's attempts — the attempts kept to the mock exams' ids, as
// legacy filtered them — handed to the shared client half.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getQuizzesForCourse } from '@/lib/quizzes/queries';
import { getStudentAttempts } from '@/lib/attempts/queries';
import type { QuizCard } from '@/lib/quizzes/types';
import type { Attempt } from '@/lib/attempts/types';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { StudentQuizList } from '@/components/quizzes/student-quiz-list';
import '@/styles/student-quizzes.css';

export const metadata: Metadata = {
  title: 'Mock Exams | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentMockExamsPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { course } = await searchParams;

  const [access, allCourses] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
  ]);
  const enrolled = allCourses.filter((c) => Boolean(access[c.course_id])).map((c) => ({ course_id: c.course_id, title: c.title }));

  const quizzesByCourse: Record<string, QuizCard[]> = {};
  const attemptsByCourse: Record<string, Attempt[]> = {};
  await Promise.all(
    enrolled.map(async (c) => {
      const [quizzes, attempts] = await Promise.all([
        getQuizzesForCourse(supabase, 'mock', c.course_id),
        getStudentAttempts(supabase, profile.user_id, c.course_id),
      ]);
      const mockIds = new Set(quizzes.map((q) => q.quiz_id));
      quizzesByCourse[c.course_id] = quizzes;
      attemptsByCourse[c.course_id] = attempts.filter((a) => a.quiz_id !== null && mockIds.has(a.quiz_id));
    }),
  );

  return (
    <>
      <PageHeader title="Mock Exams" subtitle="Time-limited exam simulations for exam periods" userName={displayNameOf(profile)} />
      <StudentQuizList
        kind="mock"
        courses={enrolled}
        quizzesByCourse={quizzesByCourse}
        attemptsByCourse={attemptsByCourse}
        activeCourseFilter={String(course || '') || null}
      />
    </>
  );
}
