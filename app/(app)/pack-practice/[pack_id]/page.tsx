// app/(app)/pack-practice/[pack_id]/page.tsx — practising a pack (07.4;
// Sam, 2026-10-15). Outside the student area's chrome, as a sitting is
// (/session): the player is the whole screen. The pack's own questions are
// read as its owner (a pack carries its answers by design; no explanation
// since 07.6) and handed to the offline player, which marks itself and
// sends nothing back. `?way=go` (Answer as you go) or `?way=end` (Answers
// at the end), chosen on the pack's page. Only the student's own active
// pack opens; anything else is not found. With 07.3 the same player runs
// from the phone's copy of the pack, with no signal (app/offline), and
// keeps a finished practice's score with that copy.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { getOfflinePackForRender } from '@/lib/offline-packs/queries';
import { toPackQuestions } from '@/lib/offline-packs/questions';
import { OfflinePlayer, type PlayerWay } from '@/components/offline-player/offline-player';
import '@/styles/runner.css';
import '@/styles/offline-player.css';

export const metadata: Metadata = {
  title: 'Practise a pack | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function PackPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ pack_id: string }>;
  searchParams: Promise<{ way?: string }>;
}) {
  const { supabase, profile } = await requireStudent();
  const { pack_id } = await params;
  const { way } = await searchParams;
  const packId = decodeURIComponent(String(pack_id || ''));

  const load = await getOfflinePackForRender(supabase, profile.user_id, packId);
  if (!load.ok) notFound();

  const items = toPackQuestions(load.items);
  const playerWay: PlayerWay = way === 'end' ? 'end' : 'go';

  return (
    <OfflinePlayer
      packId={load.pack.pack_id}
      title={load.pack.pack_name || 'Offline pack'}
      items={items}
      way={playerWay}
      exitHref={`/student/offline-packs/${encodeURIComponent(load.pack.pack_id)}`}
    />
  );
}
