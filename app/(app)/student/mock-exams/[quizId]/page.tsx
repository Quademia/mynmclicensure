// app/(app)/student/mock-exams/[quizId]/page.tsx — a mock's own page (04.15;
// Sam, 2026-10-13: board B), built as a paper's. The mock's questions never
// reach this page: only its card (loadMockExams).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { loadMockExams } from '@/lib/mock-exams/queries';
import { MockScreen } from '@/components/mock-exams/screens';

export const metadata: Metadata = {
  title: 'Mock Exams | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentMockExamPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const { supabase, profile } = await requireStudent();
  const data = await loadMockExams(supabase, profile);
  const id = decodeURIComponent(quizId);
  const mock = [...data.open, ...data.coming, ...data.past].find((m) => m.quiz_id === id);
  if (!mock) notFound();
  return <MockScreen mock={mock} ended={data.ended} />;
}
