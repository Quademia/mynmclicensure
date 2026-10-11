// app/(app)/student/quiz-builder/page.tsx — the Quiz Builder (04.4;
// Sam, 2026-10-11, layout C of his "Quiz Builder Redesign" canvas).
// Built from the plan, not from the legacy wizard it replaces.
//
// The server half: the gate, the builder's door — every course this
// student may build from, each with its pool (the whole bank or the free
// questions), why, a trial's quizzes left, and the question count it
// holds — and the config caps. The door decides from the student's
// grants, whichever page opened the builder; nothing in the address says
// "free". `?course=` (the course page, the dashboard) picks a course the
// door opened; `&topic=` (the report's and the dashboard's "Practise this
// topic") ticks that topic, kept only with that course.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getConfig } from '@/lib/catalogue/queries';
import { getBuilderDoor, withTotals } from '@/lib/attempts/builder-door';
import { BUILDER_MAX_QUESTIONS_DEFAULT, BUILDER_MINUTES_PER_QUESTION_DEFAULT } from '@/lib/attempts/types';
import { PageHeader } from '@/components/shell/page-header';
import { AppLink } from '@/components/shell/link-pending';
import { QuizBuilderClient } from './quiz-builder-client';
import '@/styles/student-quiz-builder.css';

export const metadata: Metadata = {
  title: 'Quiz builder | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function QuizBuilderPage({ searchParams }: { searchParams: Promise<{ course?: string; topic?: string }> }) {
  const gate = await requireStudent();
  const { course, topic } = await searchParams;

  const [config, door] = await Promise.all([getConfig(gate.supabase), getBuilderDoor(gate)]);
  const courses = await withTotals(gate, door);

  const maxQuestions = Number(config.builder_max_questions) > 0 ? Number(config.builder_max_questions) : BUILDER_MAX_QUESTIONS_DEFAULT;
  const minutesPerQuestion =
    Number(config.builder_minutes_per_question) > 0 ? Number(config.builder_minutes_per_question) : BUILDER_MINUTES_PER_QUESTION_DEFAULT;

  if (!courses.length) {
    return (
      <>
        <PageHeader title="Quiz builder" />
        <div className="card qb-empty">
          <p className="qb-empty-title">No courses to build from yet</p>
          <p className="qb-meta">Your programme&apos;s courses show here once your profile names your programme, or with a package.</p>
          <AppLink href="/student/upgrade" className="btn btn-primary">
            See packages
          </AppLink>
        </div>
      </>
    );
  }

  const fromUrl = String(course || '');
  const initialCourseId = courses.some((c) => c.course_id === fromUrl) ? fromUrl : '';
  const initialTopic = initialCourseId ? String(topic || '').trim() : '';

  return (
    <>
      <PageHeader title="Quiz builder" />
      <QuizBuilderClient
        courses={courses}
        maxQuestions={maxQuestions}
        minutesPerQuestion={minutesPerQuestion}
        initialCourseId={initialCourseId}
        initialTopic={initialTopic}
        userKey={gate.profile.user_id}
      />
    </>
  );
}
