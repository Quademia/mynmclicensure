// app/(app)/student/offline-packs/build/page.tsx — legacy
// student/offline-pack-builder.html (slice 13a).
//
// The server half: the gate, then what the page loaded on init — the
// config cap (offline_max_questions), the student's course access and
// the active courses (only the accessible ones reach the dropdown, as
// legacy populateCourseSelect filtered), and the `?course=` My Packs'
// "Build Similar" passes — handed to the client half, which is the
// wizard. A course's questions load on pick through the Quiz Builder's
// own Server Action (legacy called the same two API reads), and the
// allowance / pick / create go through lib/offline-packs/actions.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getConfig, getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { OFFLINE_MAX_QUESTIONS_DEFAULT } from '@/lib/offline-packs/types';
import { PageHeader } from '@/components/shell/page-header';
import { OfflineBuilderClient } from './offline-builder-client';
import '@/styles/student-offline-builder.css';

export const metadata: Metadata = {
  title: 'Offline Pack Builder | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function OfflineBuilderPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { course } = await searchParams;

  const [config, access, allCourses] = await Promise.all([
    getConfig(supabase),
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
  ]);

  // legacy effectiveOfflineLimit — the fallback equals the seed (§9 #11)
  const maxQuestions = Number(config.offline_max_questions) > 0 ? Number(config.offline_max_questions) : OFFLINE_MAX_QUESTIONS_DEFAULT;

  const accessible = allCourses.filter((c) => Boolean(access[c.course_id])).map((c) => ({ course_id: c.course_id, title: c.title }));
  const fromUrl = String(course || '');
  const initialCourseId = fromUrl && access[fromUrl] ? fromUrl : '';

  return (
    <>
      <PageHeader title="Offline Pack Builder" subtitle="Build a stored revision pack from one course at a time." />
      <OfflineBuilderClient courses={accessible} maxQuestions={maxQuestions} initialCourseId={initialCourseId} />
    </>
  );
}
