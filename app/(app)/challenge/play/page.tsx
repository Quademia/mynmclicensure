// app/(app)/challenge/play/page.tsx — today's challenge (04.25).
//
// The daily challenge's player: the quiz screen every sitting plays on,
// loaded from the challenge's own tables (04.24) — a challenge is not a
// sitting, so /session/<id> cannot open it. Outside /student, as the
// quiz's page is, so it has no sidebar; /challenge itself waits for the
// challenge's home page (04.29). Signed-in students only (04 G2).
//
// The server reads today's challenge (making the paper if this student is
// the first to open it) and shows: no programme, or no challenge today, as
// a card; no play yet, or one going, the start screen — its data only, no
// question; a play ended, its answers until midnight, with the score pill
// bringing the results back.
//
// The leaderboards (05 G1b): a student never asked, with nothing going,
// meets the offer to join before the start screen; the start screen's box
// carries this week's place to one who joined, Join the leaderboards to
// one who has not. Their card is read beside today's challenge.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { challengeCard, getChallengeToday, readChallengeSitting } from '@/lib/challenge/queries';
import { CHALLENGE_EXIT } from '@/lib/challenge/types';
import { getChallengeRanks, getJoinChoices, getLeaderboardCard, getWeekRank } from '@/lib/leaderboards/queries';
import { personOf } from '@/lib/leaderboards/types';
import { RunnerError } from '@/components/runner/runner-error';
import { ChallengeRunner } from './challenge-client';
import { ChallengeStart } from './start-screen';
import '@/styles/runner.css';
import '@/styles/challenge.css';
import '@/styles/leaderboards.css';

export const metadata: Metadata = {
  title: "Today's challenge | MyNMCLicensure",
};

export const dynamic = 'force-dynamic';

export default async function ChallengePlayPage() {
  const { supabase, profile } = await requireStudent();
  const [today, lbCard] = await Promise.all([getChallengeToday(profile.user_id), getLeaderboardCard(profile.user_id)]);

  if (!today) {
    return <RunnerError title="Could Not Load the Challenge" message="Please check your connection and try again." exit={CHALLENGE_EXIT} />;
  }
  if (!today.programId) {
    return <RunnerError title="Choose Your Programme" message="Choose your programme on your Profile to play the daily challenge." exit={CHALLENGE_EXIT} />;
  }
  if (!today.challengeId) {
    return <RunnerError title="Back Tomorrow" message="There is no challenge today. Come back tomorrow." exit={CHALLENGE_EXIT} />;
  }

  if (today.play && today.play.status !== 'playing') {
    // the answers, and the places the results pop-up brings back with them
    const [read, ranks] = await Promise.all([
      readChallengeSitting(supabase, profile.user_id, today),
      getChallengeRanks(profile.user_id, Boolean(profile.school_id)),
    ]);
    if (!read.ok) return <RunnerError title="Today's Answers Have Closed" message={read.error} exit={CHALLENGE_EXIT} />;
    return <ChallengeRunner sitting={read.sitting} reviewMode ranks={ranks} />;
  }

  const joined = lbCard?.joined === true;
  const [choices, weekRank] = await Promise.all([
    joined ? null : getJoinChoices(personOf(profile.forename, profile.surname), profile.avatar_url),
    joined ? getWeekRank(profile.user_id, Boolean(profile.school_id)) : null,
  ]);

  return (
    <ChallengeStart
      card={challengeCard(today)}
      userId={profile.user_id}
      leaderboards={{ offer: !lbCard && !today.play && choices !== null, joined, choices, weekRank }}
    />
  );
}
