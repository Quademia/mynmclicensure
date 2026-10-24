// app/(app)/student/dashboard/challenge-line.tsx — today's challenge on the
// dashboard (04.26; 04 G2, Sam 2026-10-20: C, drawn — one slim line under
// the title, in place of the top card or a card of its own; the top card
// stays as it is). For every status, the whole line one tap to the play page:
//   before playing, tinted — "Today's challenge · Midwifery · 5 questions",
//     Play ›
//   playing — the same, Resume ›
//   played — "Today's challenge done · 4 of 5 right", Review the answers ›
//     (Sam, 2026-10-20, in place of "Today · 4 of 5 right", Answers ›;
//     today's answers are open until midnight, after it the line is the
//     next day's); on a phone the link sits under the words
//   none today — "Back tomorrow", no link.
// Beneath a played line, the rank line (05 G1b; 04, built 2026-10-24), a
// tap to the Leaderboards: "4th in St Mary's this week ›" once joined, else
// "See this week's leaderboard ›". Nothing with no programme: the play page
// says to choose one.

import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { CHALLENGE_PLAY_HREF, type ChallengeToday } from '@/lib/challenge/types';
import { LEADERBOARDS_HREF, ordinal, type BoardPlace } from '@/lib/leaderboards/types';

function RankLine({ place }: { place: BoardPlace | null }) {
  return (
    <AppLink className="sd-challenge-rank" href={LEADERBOARDS_HREF}>
      <Icon name="trophy" />
      {place?.joined && place.rank ? `${ordinal(place.rank)} in ${place.board} this week ›` : "See this week's leaderboard ›"}
    </AppLink>
  );
}

export function ChallengeLine({ today, place }: { today: ChallengeToday | null; place: BoardPlace | null }) {
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
      <div className="sd-challenge-wrap">
        <AppLink className="sd-challenge sd-challenge-done" href={CHALLENGE_PLAY_HREF}>
          <span className="sd-challenge-icon"><Icon name="check-circle" /></span>
          <span className="sd-challenge-text">
            Today&apos;s challenge done · <strong>{play.right ?? 0} of {play.outOf ?? 0} right</strong>
          </span>
          <span className="sd-challenge-go">Review the answers ›</span>
        </AppLink>
        <RankLine place={place} />
      </div>
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
