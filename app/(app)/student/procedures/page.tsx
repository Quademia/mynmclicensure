// app/(app)/student/procedures/page.tsx — legacy student/procedures.html.
//
// The server half (slice 7c): the gate, then what legacy's initPage
// read — the student's programme id from the profile and its display
// name from `programs` — handed to the client half, which is the page.
// Legacy fell back to a second profile read when program_id was empty;
// the gate's profile is the whole row, so there is nothing to fall
// back to. The title said "QAcademy"; the brand rule makes it
// MyNMCLicensure's title shape.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getPrograms } from '@/lib/catalogue/queries';
import { PageHeader } from '@/components/shell/page-header';
import { ProceduresClient } from './procedures-client';
import '@/styles/student-procedures.css';

export const metadata: Metadata = {
  title: 'Practical Skills — Procedures | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function ProceduresPage() {
  const { supabase, profile } = await requireStudent();
  const programRaw = profile.program_id || '';
  const programs = programRaw ? await getPrograms(supabase) : [];
  const programName = programs.find((p) => p.program_id === programRaw)?.program_name ?? null;

  return (
    <>
      <PageHeader title="Practical Skills — Procedures" subtitle="NMC Ghana procedure manuals for OSCE preparation" />
      <ProceduresClient programRaw={programRaw} programName={programName} />
    </>
  );
}
