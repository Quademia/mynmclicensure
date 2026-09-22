// app/(app)/student/quiz-builder/page.tsx — legacy student/quiz-builder.html.
//
// The server half: the gate, then what the page loaded on init — the
// config caps (builder_max_questions, builder_minutes_per_question), the
// student's course access and the active courses (only the accessible
// ones reach the dropdown, as legacy populateCourseSelect filtered), and
// the `?course=` the course page passes — handed to the client half,
// which is the wizard. A course's questions load on pick through a
// Server Action, as legacy fetched them on change.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getConfig, getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { BUILDER_MAX_QUESTIONS_DEFAULT, BUILDER_MINUTES_PER_QUESTION_DEFAULT } from '@/lib/attempts/types';
import { PageHeader } from '@/components/shell/page-header';
import { QuizBuilderClient } from './quiz-builder-client';
import '@/styles/student-quiz-builder.css';

export const metadata: Metadata = {
  title: 'Quiz Builder | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function QuizBuilderPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { course } = await searchParams;

  const [config, access, allCourses] = await Promise.all([
    getConfig(supabase),
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
  ]);

  // legacy effectiveBuilderLimit / MINUTES_PER_QUESTION
  const maxQuestions = Number(config.builder_max_questions) > 0 ? Number(config.builder_max_questions) : BUILDER_MAX_QUESTIONS_DEFAULT;
  const minutesPerQuestion =
    Number(config.builder_minutes_per_question) > 0 ? Number(config.builder_minutes_per_question) : BUILDER_MINUTES_PER_QUESTION_DEFAULT;

  const accessible = allCourses.filter((c) => Boolean(access[c.course_id])).map((c) => ({ course_id: c.course_id, title: c.title }));
  const fromUrl = String(course || '');
  const initialCourseId = fromUrl && access[fromUrl] ? fromUrl : '';

  return (
    <>
      <PageHeader title="Quiz Builder" subtitle="Build a custom quiz from one course at a time." />
      <QuizBuilderClient
        courses={accessible}
        maxQuestions={maxQuestions}
        minutesPerQuestion={minutesPerQuestion}
        initialCourseId={initialCourseId}
      />
    </>
  );
}
