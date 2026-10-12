// app/(app)/student/practice-papers/page.tsx — Practice Papers, the courses
// (04.7; Sam, 2026-10-12). The server half: the gate, then
// loadPracticePapers (lib/practice-papers/queries.ts); the screen is
// components/practice-papers/screens.tsx.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { loadPracticePapers } from '@/lib/practice-papers/queries';
import { CoursesScreen } from '@/components/practice-papers/screens';

export const metadata: Metadata = {
  title: 'Practice Papers | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentPracticePapersPage() {
  const { supabase, profile } = await requireStudent();
  const data = await loadPracticePapers(supabase, profile);
  return <CoursesScreen data={data} />;
}
