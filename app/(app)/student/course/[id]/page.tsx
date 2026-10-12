// app/(app)/student/course/[id]/page.tsx — the course page, redesigned
// (04.9; Sam, 2026-10-12; 11-pages.md "My courses and the course page").
// A front door and a progress summary: Up next, three rows into the
// stand-alone pages, the course's news. A course the student is not shown
// (not held, and not their programme's) is a 404.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { loadCoursePage } from '@/lib/courses/queries';
import { CourseScreen } from '@/components/courses/screens';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: 'Course | MyNMCLicensure',
};

export default async function CoursePage({ params }: { params: Params }) {
  const gate = await requireStudent();
  const { id } = await params;
  const data = await loadCoursePage(gate, decodeURIComponent(String(id || '').trim()));
  if (!data) notFound();
  return <CourseScreen data={data} />;
}
