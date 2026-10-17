// app/(app)/admin/question-bank/page.tsx — legacy admin/question-bank.html.
//
// The server half: the gate, then the one list the page loaded on init —
// every course, archived included, for the course picker (legacy
// getAllCourses) — handed to the client half, which is the page's
// script. The questions themselves load per course, on pick, through a
// Server Action, as legacy fetched them on change.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllCourses } from '@/lib/catalogue/queries';
import { PageHeader } from '@/components/shell/page-header';
import { QuestionBankClient } from './question-bank-client';
import '@/styles/admin-question-bank.css';

export const metadata: Metadata = {
  title: 'Question Bank | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

type Search = Promise<{ course?: string; item?: string }>;

// ?course=…&item=… (the Question reports page's "Open in the bank", 06.2):
// the course picked and that question's editor opened on arrival.
export default async function AdminQuestionBankPage({ searchParams }: { searchParams: Search }) {
  const { supabase } = await requireAdmin();
  const [courses, params] = await Promise.all([getAllCourses(supabase), searchParams]);
  const openCourse = String(params.course || '').trim();
  const openItem = String(params.item || '').trim();

  return (
    <>
      <PageHeader
        title="Question Bank"
        subtitle="Browse, edit and manage questions across all courses"
      />
      <QuestionBankClient
        courses={courses}
        open={openCourse && courses.some((c) => c.course_id === openCourse) ? { course: openCourse, item: openItem || null } : null}
      />
    </>
  );
}
