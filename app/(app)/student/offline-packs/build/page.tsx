// app/(app)/student/offline-packs/build/page.tsx — the pack builder (07.2;
// Sam, 2026-10-15: the Quiz Builder with a pack's extras).
//
// The server half: the gate, the pack door — every course this student
// holds now whose package includes packs, each with its packs left and the
// Practice and Free questions it holds — and the pack limit (Config's
// offline_max_questions). The page is the Quiz Builder's (components/
// builder) in its pack version. A trial or free student, whose package has
// no packs, gets the locked card (07: "Offline packs come with a package").
// `?course=` (My packs' Build a pack) picks a course the door opened.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getConfig } from '@/lib/catalogue/queries';
import { getPackDoorWithTotals } from '@/lib/offline-packs/door';
import { OFFLINE_MAX_QUESTIONS_DEFAULT } from '@/lib/offline-packs/types';
import { BUILDER_MINUTES_PER_QUESTION_DEFAULT } from '@/lib/attempts/types';
import { PageHeader } from '@/components/shell/page-header';
import { AppLink } from '@/components/shell/link-pending';
import { QuizBuilderClient } from '@/components/builder/builder-client';
import '@/styles/student-quiz-builder.css';

export const metadata: Metadata = {
  title: 'Build a pack | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function PackBuilderPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const gate = await requireStudent();
  const { course } = await searchParams;

  const [config, courses] = await Promise.all([getConfig(gate.supabase), getPackDoorWithTotals(gate)]);
  const maxQuestions = Number(config.offline_max_questions) > 0 ? Number(config.offline_max_questions) : OFFLINE_MAX_QUESTIONS_DEFAULT;

  if (!courses.length) {
    return (
      <>
        <PageHeader title="Build a pack" subtitle="A pack of questions to practise on your phone, even with no signal." />
        <div className="card qb-empty">
          <p className="qb-empty-title">Offline packs come with a package</p>
          <p className="qb-meta">With a package you can make packs of questions, practise them on your phone with no signal, and print them.</p>
          <AppLink href="/student/upgrade" className="btn btn-primary btn-lg">
            Choose a package
          </AppLink>
        </div>
      </>
    );
  }

  const fromUrl = String(course || '');
  const initialCourseId = courses.some((c) => c.course_id === fromUrl) ? fromUrl : '';

  return (
    <>
      <PageHeader title="Build a pack" subtitle="A pack of questions to practise on your phone, even with no signal." />
      <QuizBuilderClient
        kind="pack"
        courses={courses}
        maxQuestions={maxQuestions}
        minutesPerQuestion={BUILDER_MINUTES_PER_QUESTION_DEFAULT}
        initialCourseId={initialCourseId}
        initialTopic=""
        userKey={gate.profile.user_id}
      />
    </>
  );
}
