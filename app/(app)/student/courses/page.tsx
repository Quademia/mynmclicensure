// app/(app)/student/courses/page.tsx — My courses (04.8; Sam, 2026-10-12).
// What the menu's "My courses" row opens: a card per course. The server
// half is lib/courses/queries.ts; the screen is components/courses/screens.tsx.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { loadMyCourses } from '@/lib/courses/queries';
import { MyCoursesScreen } from '@/components/courses/screens';

export const metadata: Metadata = {
  title: 'My courses | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentCoursesPage() {
  const gate = await requireStudent();
  const data = await loadMyCourses(gate);
  return <MyCoursesScreen data={data} />;
}
