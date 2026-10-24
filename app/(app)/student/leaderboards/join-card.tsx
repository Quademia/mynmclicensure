// app/(app)/student/leaderboards/join-card.tsx — before joining, the
// student's place reads "Join to see where you rank" with Join (05 G1b;
// Sam, 2026-10-20). Join opens How you'll appear in its place — the same
// screen as on the way to the challenge; Done joins and the page reads the
// board again with the student on it; Cancel puts the card back.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { joinLeaderboards } from '@/lib/leaderboards/actions';
import type { JoinChoices, ShownAs } from '@/lib/leaderboards/types';
import { AppearPicker } from '@/components/leaderboards/appear-picker';

export function JoinCard({ choices }: { choices: JoinChoices }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function done(shownAs: ShownAs, word: string, animal: string) {
    setJoining(true);
    try {
      const r = await joinLeaderboards(shownAs, word, animal);
      if (!r.ok) {
        setToast(r.error);
        setJoining(false);
        return;
      }
      router.refresh();
    } catch {
      setToast('Could not join the leaderboards. Please check your connection and try again.');
      setJoining(false);
    }
  }

  return (
    <>
      <Toast message={toast} onDismiss={() => setToast(null)} />
      {open ? (
        <AppearPicker choices={choices} pending={joining} joining={joining} onDone={(s, w, a) => void done(s, w, a)} onCancel={() => setOpen(false)} />
      ) : (
        <div className="lbp-me lbp-join">
          <div className="lbp-join-text">
            <p className="lbp-me-place">Join to see where you rank</p>
            <p className="lbp-me-detail">Your past challenges count.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Join
          </button>
        </div>
      )}
    </>
  );
}
