// lib/challenge/types.ts
//
// The daily challenge (04 G2) as the app reads it. Its database is its own
// (04.24: the day's paper, its questions stored once, a play per student
// per day, the play's answer lines), read and written only through the
// database's functions; the quiz screen plays it (04.25), handed the play
// in a sitting's shape and the challenge's own saving and ending in place
// of the quiz engine's. No server import here: client pages read it.

import type { ActionResult, AnswerPatch, Attempt, FinishResult, SealedItem, SecretsMap } from '@/lib/attempts/types';
import type { SessionExit } from '@/lib/attempts/links';

export type ChallengePlayStatus = 'playing' | 'submitted' | 'time_up';

/** A student's play today. */
export type ChallengePlay = {
  playId: string;
  challengeId: string;
  status: ChallengePlayStatus;
  startedUtc: string;
  endsUtc: string;
  submittedUtc: string | null;
  timeTakenS: number | null;
  right: number | null;
  outOf: number | null;
};

/** challenge_today(): today's paper for the student's programme, and their play today. */
export type ChallengeToday = {
  /** The day, YYYY-MM-DD (UTC, Ghana's time). */
  day: string;
  /** Null: the account has no programme. */
  programId: string | null;
  /** Null: no challenge today ("Back tomorrow"). */
  challengeId: string | null;
  courseId: string | null;
  courseTitle: string | null;
  /** The paper's questions, a voided one out. */
  questions: number;
  minutesPerQuestion: number;
  play: ChallengePlay | null;
};

/** What the quiz screen needs to play or show a challenge. */
export type ChallengeSitting = {
  /** The play in a sitting's shape: the quiz screen's header, clock and score read it. */
  attempt: Attempt;
  items: SealedItem[];
  /** Every question's answer and explanation once the play has ended; none before. */
  secrets: SecretsMap;
  /** The questions the admin voided — out of the score. */
  voided: string[];
  status: ChallengePlayStatus;
  questionsPerPage: number;
};

/** The challenge's saving and ending, handed to the quiz screen in place of the quiz engine's. */
export type ChallengeRun = {
  save: (rows: AnswerPatch[]) => Promise<ActionResult>;
  /** Submit; past the limit the database closes it as time up. */
  finish: () => Promise<FinishResult>;
  voided: string[];
  /** Opened after its time ran out. */
  timeUp: boolean;
};

export type ChallengeStartResult = { ok: true; sitting: ChallengeSitting } | { ok: false; error: string };

/** What the start screen shows — no question reaches the page before Start. */
export type ChallengeCard = {
  courseTitle: string;
  /** "Tuesday 20 October". */
  dayLabel: string;
  questions: number;
  minutes: number;
  resuming: boolean;
  /** A play going: the seconds left on the server's clock. */
  secondsLeft: number | null;
};

/** Where the challenge's Exit, Cancel and the results' way back go, until it has a home page (04.29). */
export const CHALLENGE_EXIT: SessionExit = { href: '/student/dashboard', label: 'Back to dashboard' };

/** The play page. */
export const CHALLENGE_PLAY_HREF = '/challenge/play';
