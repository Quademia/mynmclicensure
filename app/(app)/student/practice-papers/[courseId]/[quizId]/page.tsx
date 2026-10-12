// app/(app)/student/practice-papers/[courseId]/[quizId]/page.tsx — a paper's
// own page (04.7; Sam, 2026-10-12). The paper's questions never reach this
// page: only its card (loadPracticePapers).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { loadPracticePapers } from '@/lib/practice-papers/queries';
import { PaperScreen } from '@/components/practice-papers/screens';

export const metadata: Metadata = {
  title: 'Practice Papers | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentPracticePaperPage({ params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const { courseId, quizId } = await params;
  const { supabase, profile } = await requireStudent();
  const data = await loadPracticePapers(supabase, profile);
  const course = data.courses.find((c) => c.course_id === decodeURIComponent(courseId));
  const paper = course?.papers.find((p) => p.quiz_id === decodeURIComponent(quizId));
  if (!course || !paper) notFound();
  return <PaperScreen course={course} paper={paper} ended={data.ended} />;
}
