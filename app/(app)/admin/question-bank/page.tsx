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

export default async function AdminQuestionBankPage() {
  const { supabase } = await requireAdmin();
  const courses = await getAllCourses(supabase);

  return (
    <>
      <PageHeader
        title="Question Bank"
        subtitle="Browse, edit and manage questions across all courses"
      />
      <QuestionBankClient courses={courses} />
    </>
  );
}
