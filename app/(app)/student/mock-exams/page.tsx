// app/(app)/student/mock-exams/page.tsx — the Mock exams page, redesigned
// (04.15; Sam, 2026-10-13: layout A): one screen by time — Open now, Coming
// up, Past mocks. The mocks' questions never reach this page: only their
// cards (loadMockExams).

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { loadMockExams } from '@/lib/mock-exams/queries';
import { MockListScreen } from '@/components/mock-exams/screens';

export const metadata: Metadata = {
  title: 'Mock Exams | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentMockExamsPage() {
  const { supabase, profile } = await requireStudent();
  const data = await loadMockExams(supabase, profile);
  return <MockListScreen data={data} />;
}
