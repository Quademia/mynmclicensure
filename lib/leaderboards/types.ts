// lib/leaderboards/types.ts
//
// The leaderboards (05 G1b) as the app reads them. A student's card
// (leaderboard_cards, 05.7) — asked once, joined, how they appear, the
// username — is read and written only through the database's own
// functions, which also hold the word and animal lists Sam approved. No
// server import here: client pages read it.

export type ShownAs = 'username' | 'name';

/** leaderboard_card(): null before the student was first asked. */
export type LeaderboardCard = {
  joined: boolean;
  shownAs: ShownAs;
  /** The username's parts; null until the student joins. */
  word: string | null;
  animal: string | null;
  /** "Brave Lion", "Brave Lion 2". */
  username: string | null;
  /** "Ama O." — the first name and the surname's initial. */
  person: string | null;
  photo: string | null;
  /** The username was changed this week: "Saturday 31 October", the day it
   * may change again; null when it may change now. Worked out on the server. */
  renameFrom: string | null;
};

/** What How you'll appear needs — on the page before Join, so no tap waits. */
export type JoinChoices = {
  words: string[];
  animals: string[];
  /** The card's first word and animal, picked at random. */
  first: { word: string; animal: string };
  person: string | null;
  photo: string | null;
};

/** The start screen's box for a student who has joined. */
export type WeekRank = {
  /** 4 — null before their first play this week. */
  rank: number | null;
  /** "St Mary's" or the programme ("RM") when they have no school. */
  board: string;
};

/** A student's place on their own board (the school's, else the programme's). */
export type BoardPlace = {
  joined: boolean;
  /** Null when they are not on it (not joined, or no play in the time). */
  rank: number | null;
  /** "St Mary's" or the programme ("RM"). */
  board: string;
};

/** The results pop-up's line (04): today's place and this week's. */
export type ChallengeRanks = {
  joined: boolean;
  today: number | null;
  week: number | null;
  board: string;
};

// ── The Leaderboards page (05 G1b; Sam, 2026-10-20: B) ────────────────

export const BOARD_PERIODS = ['today', 'week', 'all'] as const;
export type BoardPeriod = (typeof BOARD_PERIODS)[number];
export const BOARD_VIEWS = ['school', 'programme', 'ghana', 'schools'] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

export const PERIOD_LABELS: Record<BoardPeriod, string> = {
  today: 'Today',
  week: 'This week',
  all: 'All time',
};

export const LEADERBOARDS_HREF = '/student/leaderboards';

export function boardHref(period: BoardPeriod, view: BoardView): string {
  return period === 'week' && view === 'school' ? LEADERBOARDS_HREF : `${LEADERBOARDS_HREF}?period=${period}&board=${view}`;
}

/** A student's line on a board. */
export type BoardLine = {
  rank: number;
  /** The username, or "Ama O." for one shown by name. */
  name: string;
  animal: string | null;
  photo: string | null;
  right: number;
  timeS: number;
  played: number;
  /** All time: the average right answers per challenge and the average time. */
  average: number | null;
  averageTimeS: number | null;
  isMe: boolean;
};

/** A school's line on the Schools board. */
export type SchoolLine = {
  rank: number;
  school: string;
  players: number;
  /** The average of its best 10. */
  average: number;
  averageTimeS: number;
  isMine: boolean;
};

type BoardHead = {
  period: BoardPeriod;
  view: BoardView;
  /** The programme's code ("RN"); null without one. */
  programId: string | null;
  schoolId: number | null;
  schoolName: string | null;
  schoolSuggested: boolean;
  joined: boolean;
  /** All time: challenges played before a student shows (10). */
  minPlayed: number;
  /** Schools: players before a school shows (10). */
  minPlayers: number;
};

export type PeopleBoard = BoardHead & {
  kind: 'people';
  players: number;
  top: BoardLine[];
  me: BoardLine | null;
  /** Outside the top 10: the one above, the student, the one below. */
  around: BoardLine[];
  /** Challenges the student played in the time (All time's "3 played"). */
  mePlayed: number;
};

export type SchoolsBoard = BoardHead & {
  kind: 'schools';
  schools: number;
  top: SchoolLine[];
  mine: { school: string; suggested: boolean; players: number; rank: number | null; of: number; needed: number | null } | null;
  around: SchoolLine[];
  waiting: { school: string; players: number; needed: number; isMine: boolean }[];
};

export type Board = PeopleBoard | SchoolsBoard;

/** "1:12" under an hour, "1 h 4 min" past it. */
export function clockOf(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "17 min 31 s", "45 s". */
export function longTimeOf(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}

export type JoinResult = { ok: true; card: LeaderboardCard } | { ok: false; error: string };
/** Leave, how you appear, rename: the card as it now is. */
export type CardResult = JoinResult;
export type NotNowResult = { ok: true } | { ok: false; error: string };

/** Up to 3 spins of the word (05; Sam, 2026-10-20). */
export const WORD_SPINS = 3;

/** The animal's drawing: Google's Noto Emoji, public/animals (Apache 2.0). */
export function animalSrc(animal: string): string {
  return `/animals/${animal.toLowerCase()}.svg`;
}

/** "Ama O." — as the database's _leaderboard_person; null with no first name. */
export function personOf(forename: string | null, surname: string | null): string | null {
  const first = (forename || '').trim();
  if (!first) return null;
  const initial = (surname || '').trim().charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

/** What the challenge's start screen carries for the leaderboards. */
export type StartLeaderboards = {
  /** Never asked, nothing going: the offer comes before the start screen. */
  offer: boolean;
  joined: boolean;
  /** For How you'll appear; null when the student has joined or a read failed. */
  choices: JoinChoices | null;
  weekRank: WeekRank | null;
};

/** 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const ones = n % 10;
  return `${n}${ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'}`;
}
