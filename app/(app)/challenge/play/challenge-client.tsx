// app/(app)/challenge/play/challenge-client.tsx
//
// The daily challenge on the quiz screen (04.25): the play in a sitting's
// shape, with the challenge's own saving and ending handed in — the quiz
// screen is the one every sitting plays on; only the page that loads it
// differs (Sam, 2026-10-20: "a player on a different route that uses the
// shared things"). The leaderboards' places for the results pop-up (05
// G1b) come with Submit's reply, or with the page when the answers are
// reopened.

'use client';

import { useMemo, useState } from 'react';
import { QuizRunner } from '@/components/runner/quiz-runner';
import { saveChallengeAnswers, submitChallenge } from '@/lib/challenge/actions';
import { CHALLENGE_EXIT, type ChallengeRun, type ChallengeSitting } from '@/lib/challenge/types';
import type { ChallengeRanks } from '@/lib/leaderboards/types';

export function ChallengeRunner({
  sitting,
  reviewMode,
  ranks: initialRanks = null,
}: {
  sitting: ChallengeSitting;
  reviewMode: boolean;
  ranks?: ChallengeRanks | null;
}) {
  const playId = sitting.attempt.attempt_id;
  const [ranks, setRanks] = useState<ChallengeRanks | null>(initialRanks);
  const run = useMemo<ChallengeRun>(
    () => ({
      save: (rows) => saveChallengeAnswers(playId, rows),
      finish: async () => {
        const r = await submitChallenge(playId);
        if (r.ok && r.ranks !== undefined) setRanks(r.ranks);
        return r;
      },
      voided: sitting.voided,
      timeUp: sitting.status === 'time_up',
    }),
    [playId, sitting.voided, sitting.status],
  );
  return (
    <QuizRunner
      attempt={sitting.attempt}
      items={sitting.items}
      secrets={sitting.secrets}
      questionsPerPage={sitting.questionsPerPage}
      reviewMode={reviewMode}
      previewMode={false}
      exit={CHALLENGE_EXIT}
      challenge={run}
      challengeRanks={ranks}
    />
  );
}
