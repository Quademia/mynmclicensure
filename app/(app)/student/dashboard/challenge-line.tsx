// app/(app)/student/dashboard/challenge-line.tsx — today's challenge on the
// dashboard (04.26; 04 G2, Sam 2026-10-20: C, drawn — one slim line under
// the title, in place of the top card or a card of its own; the top card
// stays as it is). For every status, the whole line one tap to the play page:
//   before playing, tinted — "Today's challenge · Midwifery · 5 questions",
//     Play ›
//   playing — the same, Resume ›
//   played — "Today · 4 of 5 right", Answers › (today's answers are open
//     until midnight; after it, the line is the next day's)
//   none today — "Back tomorrow", no link.
// The rank line comes with the leaderboards (05 G1b). Nothing with no
// programme: the play page says to choose one.

import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { CHALLENGE_PLAY_HREF, type ChallengeToday } from '@/lib/challenge/types';

export function ChallengeLine({ today }: { today: ChallengeToday | null }) {
  if (!today || !today.programId) return null;

  if (!today.challengeId) {
    return (
      <div className="sd-challenge">
        <span className="sd-challenge-icon"><Icon name="zap" /></span>
        <span className="sd-challenge-text">Today&apos;s challenge · Back tomorrow</span>
      </div>
    );
  }

  const play = today.play;
  if (play && play.status !== 'playing') {
    return (
      <AppLink className="sd-challenge" href={CHALLENGE_PLAY_HREF}>
        <span className="sd-challenge-icon"><Icon name="zap" /></span>
        <span className="sd-challenge-text">
          Today · <strong>{play.right ?? 0} of {play.outOf ?? 0} right</strong>
        </span>
        <span className="sd-challenge-go">Answers ›</span>
      </AppLink>
    );
  }

  return (
    <AppLink className="sd-challenge sd-challenge-new" href={CHALLENGE_PLAY_HREF}>
      <span className="sd-challenge-icon"><Icon name="zap" /></span>
      <span className="sd-challenge-text">
        <strong>Today&apos;s challenge</strong> · {today.courseTitle} · {today.questions} questions
      </span>
      <span className="sd-challenge-go">{play ? 'Resume ›' : 'Play ›'}</span>
    </AppLink>
  );
}
