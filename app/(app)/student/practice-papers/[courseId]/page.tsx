// app/(app)/student/practice-papers/[courseId]/page.tsx — Practice Papers,
// a course (04.7; Sam, 2026-10-12). A course the student is not shown
// (not held and not their programme's) is a 404.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { loadPracticePapers } from '@/lib/practice-papers/queries';
import { CourseScreen } from '@/components/practice-papers/screens';

export const metadata: Metadata = {
  title: 'Practice Papers | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentPracticePapersCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase, profile } = await requireStudent();
  const data = await loadPracticePapers(supabase, profile);
  const course = data.courses.find((c) => c.course_id === decodeURIComponent(courseId));
  if (!course) notFound();
  return <CourseScreen course={course} tabs={data.courses.map((c) => ({ course_id: c.course_id, title: c.title }))} ended={data.ended} />;
}
