// app/(app)/student/offline-packs/course/[course_id]/page.tsx — a course's
// packs (07.8, C; Sam, 2026-10-15, drawn at
// https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm, "C · a tap on a
// course"). What a course card on My packs opens, as a course does in
// Practice Papers: ‹ My packs, the course with its allowance bar, Build a
// pack across the page (while packs are left), then Your packs, newest
// first, each with its On this phone mark — a row opens the pack's own
// page. A course whose package has ended shows its packs, no Build. A
// course with neither a door nor a pack is not found.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getPackDoor } from '@/lib/offline-packs/door';
import { listMyPacks } from '@/lib/offline-packs/queries';
import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { Allowance, BUILD_HREF, PackRows } from '../../pack-parts';
import '@/styles/practice-papers.css';
import '@/styles/courses.css';
import '@/styles/student-offline-packs.css';

export const metadata: Metadata = {
  title: 'My packs | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function PackCoursePage({ params }: { params: Promise<{ course_id: string }> }) {
  const gate = await requireStudent();
  const { course_id } = await params;
  const courseId = decodeURIComponent(String(course_id || ''));
  const [door, packs, courses] = await Promise.all([
    getPackDoor(gate),
    listMyPacks(gate.supabase, gate.profile.user_id),
    getCourses(gate.supabase),
  ]);
  const open = door.find((c) => c.course_id === courseId) ?? null;
  const here = (packs ?? []).filter((p) => p.course_id === courseId);
  if (!open && !here.length && packs !== null) notFound();
  const title = open?.title ?? courses.find((c) => c.course_id === courseId)?.title ?? courseId;

  return (
    <div className="pp-page opk">
      <AppLink href="/student/offline-packs" className="btn-link pp-back">
        ‹ My packs
      </AppLink>

      {/* the shared title over the allowance, as a course's heading in
          Practice Papers has it (courses.css .cp-head; Sam, 2026-10-30) */}
      <div className="cp-head">
        <PageHeader title={title} />
        {open ? (
          <Allowance allowed={open.packsAllowed} left={open.packsLeft} />
        ) : (
          <span className="cp-line">Made with an earlier package. These packs still open.</span>
        )}
      </div>

      {open && open.packsLeft !== 0 ? (
        <AppLink href={`${BUILD_HREF}?course=${encodeURIComponent(courseId)}`} className="btn btn-accent btn-lg">
          Build a pack
        </AppLink>
      ) : null}

      {packs === null ? (
        <p className="pp-note">Your packs could not be loaded. Please refresh the page.</p>
      ) : here.length ? (
        <section className="opk-course" aria-labelledby="opk-yours">
          <h2 id="opk-yours" className="opk-title">
            Your packs
          </h2>
          <PackRows packs={here} />
        </section>
      ) : (
        <p className="pp-line">No packs in this course yet.</p>
      )}
    </div>
  );
}
