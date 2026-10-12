// app/(app)/student/fixed-quizzes/page.tsx — the old address of Practice
// Papers (04 Q21; the page is app/(app)/student/practice-papers). Kept so
// a bookmark, a link in an email or a pack still lands; `?course=` goes to
// that course's papers.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StudentFixedQuizzesPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { course } = await searchParams;
  redirect(course ? `/student/practice-papers/${encodeURIComponent(String(course))}` : '/student/practice-papers');
}
