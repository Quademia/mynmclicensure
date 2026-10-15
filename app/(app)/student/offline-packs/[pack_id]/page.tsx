// app/(app)/student/offline-packs/[pack_id]/page.tsx — a pack's own page
// (07.8; Sam, 2026-10-15, drawn at
// https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm): the pack's name, its
// course, how many questions, when it was made and what was picked; the way
// to print it; Delete, with the app's confirm. Practise opens the offline
// player (07.4) in either way. On this phone (07.3): the card's mark and the
// last score on this phone, and under it Save to this phone or Remove from
// this phone (phone-pack.tsx); ?new=1, from the builder, keeps it on the
// phone it was made on. Download PDF (07.5) makes the pack's PDF on the
// phone, the answers where the student chooses (download-pdf.tsx). Its way
// back is its course's packs (C, like Practice Papers), and Delete lands
// there too. Only the student's own active pack opens; anything else is not
// found.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getMyPack } from '@/lib/offline-packs/queries';
import { pickedWords } from '@/lib/offline-packs/labels';
import { AppLink } from '@/components/shell/link-pending';
import { PhoneKeep, PhoneMark } from '../phone-pack';
import { courseHref } from '../pack-parts';
import { DeletePack } from './delete-pack';
import { DownloadPdf } from './download-pdf';
import { PractisePack } from './practise-pack';
import '@/styles/practice-papers.css';
import '@/styles/student-offline-packs.css';

export const metadata: Metadata = {
  title: 'Offline pack | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

function longDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}


export default async function PackPage({
  params,
  searchParams,
}: {
  params: Promise<{ pack_id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const gate = await requireStudent();
  const { pack_id } = await params;
  const { new: made } = await searchParams;
  const [pack, courses] = await Promise.all([
    getMyPack(gate.supabase, gate.profile.user_id, decodeURIComponent(String(pack_id || ''))),
    getCourses(gate.supabase),
  ]);
  if (!pack) notFound();
  const course = courses.find((c) => c.course_id === pack.course_id)?.title ?? pack.course_id;
  const n = pack.question_count;

  return (
    <div className="pp-page opk">
      <AppLink href={courseHref(pack.course_id)} className="btn-link pp-back">
        ‹ {course}
      </AppLink>

      <div className="opk-pack-facts">
        <h1 className="opk-pack-title">{pack.pack_name || 'Offline pack'}</h1>
        <span className="pp-line">
          {course} · {n} {n === 1 ? 'question' : 'questions'} · made {longDay(pack.created_utc)}
        </span>
        <span className="pp-line">{pickedWords(pack)}</span>
      </div>

      <div className="card pp-card">
        <PhoneMark packId={pack.pack_id} />
        <PractisePack packId={pack.pack_id} title={pack.pack_name || 'this pack'} />
        <DownloadPdf packId={pack.pack_id} title={pack.pack_name || 'this pack'} />
      </div>

      <PhoneKeep packId={pack.pack_id} autoSave={made === '1'} />

      <DeletePack packId={pack.pack_id} backHref={courseHref(pack.course_id)} />
    </div>
  );
}
