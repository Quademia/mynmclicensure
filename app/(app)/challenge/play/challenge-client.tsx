// app/(app)/challenge/play/challenge-client.tsx
//
// The daily challenge on the quiz screen (04.25): the play in a sitting's
// shape, with the challenge's own saving and ending handed in — the quiz
// screen is the one every sitting plays on; only the page that loads it
// differs (Sam, 2026-10-20: "a player on a different route that uses the
// shared things").

'use client';

import { useMemo } from 'react';
import { QuizRunner } from '@/components/runner/quiz-runner';
import { saveChallengeAnswers, submitChallenge } from '@/lib/challenge/actions';
import { CHALLENGE_EXIT, type ChallengeRun, type ChallengeSitting } from '@/lib/challenge/types';

export function ChallengeRunner({ sitting, reviewMode }: { sitting: ChallengeSitting; reviewMode: boolean }) {
  const playId = sitting.attempt.attempt_id;
  const run = useMemo<ChallengeRun>(
    () => ({
      save: (rows) => saveChallengeAnswers(playId, rows),
      finish: () => submitChallenge(playId),
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
    />
  );
}
