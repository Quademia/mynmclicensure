// app/(app)/student/offline-packs/[pack_id]/page.tsx — a pack's own page
// (07.8; Sam, 2026-10-15, drawn at
// https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm): the pack's name, its
// course, how many questions, when it was made and what was picked; the way
// to print it; Delete, with the app's confirm. Practise opens the offline
// player (07.4) in either way. On this phone (07.3): the card's mark and the
// last score on this phone, and under it Save to this phone or Remove from
// this phone (phone-pack.tsx); ?new=1, from the builder, keeps it on the
// phone it was made on. The redesigned PDF comes with 07.5 — until then the
// print button opens today's print page. Only the student's own active pack
// opens; anything else is not found.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getMyPack } from '@/lib/offline-packs/queries';
import type { MyPack } from '@/lib/offline-packs/types';
import { AppLink } from '@/components/shell/link-pending';
import { PhoneKeep, PhoneMark } from '../phone-pack';
import { DeletePack } from './delete-pack';
import { PractisePack } from './practise-pack';
import '@/styles/practice-papers.css';
import '@/styles/student-offline-packs.css';

export const metadata: Metadata = {
  title: 'Offline pack | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = { MCQ: 'Single answer', SATA: 'Select all that apply', TF: 'True / False' };

function longDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** What was picked, in a line: the topics (or the keyword), then any difficulty or type. */
function picked(p: MyPack): string {
  const what =
    p.selection_mode === 'concept' && p.concept_query
      ? `Keyword “${p.concept_query}”${p.maintopics?.length ? ` in ${p.maintopics.join(', ')}` : ''}`
      : p.maintopics?.length
        ? p.maintopics.join(', ')
        : 'All topics';
  const parts = [what];
  if (p.difficulties?.length) parts.push(p.difficulties.join(', '));
  if (p.question_types?.length) parts.push(p.question_types.map((t) => TYPE_LABEL[t] || t).join(', '));
  return parts.join(' · ');
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
      <AppLink href="/student/offline-packs" className="btn-link pp-back">
        ‹ My packs
      </AppLink>

      <div className="opk-pack-facts">
        <h1 className="opk-pack-title">{pack.pack_name || 'Offline pack'}</h1>
        <span className="pp-line">
          {course} · {n} {n === 1 ? 'question' : 'questions'} · made {longDay(pack.created_utc)}
        </span>
        <span className="pp-line">{picked(pack)}</span>
      </div>

      <div className="card pp-card">
        <PhoneMark packId={pack.pack_id} />
        <PractisePack packId={pack.pack_id} title={pack.pack_name || 'this pack'} />
        <AppLink href={`/offline-pack?pack_id=${encodeURIComponent(pack.pack_id)}`} className="btn btn-ghost btn-lg">
          Print or save as PDF
        </AppLink>
      </div>

      <PhoneKeep packId={pack.pack_id} autoSave={made === '1'} />

      <DeletePack packId={pack.pack_id} />
    </div>
  );
}
