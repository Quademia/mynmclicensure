// app/(app)/student/portal-guide/page.tsx — legacy student/portal-guide.html.
//
// The server half (slice 7b): the gate and the page header, then the
// client half, which is the guide itself — the page reads nothing from
// the database (legacy's script only filled the sidebar, which the
// student layout does now). The subtitle said "QAcademy"; the brand
// rule (UI convention #5) makes it Quademia.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { PortalGuide } from './portal-guide-client';
import '@/styles/student-portal-guide.css';

export const metadata: Metadata = {
  title: 'Portal Guide | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function PortalGuidePage() {
  const { profile } = await requireStudent();
  return (
    <>
      <PageHeader title="Portal Guide" subtitle="How to use Quademia effectively" userName={displayNameOf(profile)} />
      <PortalGuide />
    </>
  );
}
