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

export type JoinResult = { ok: true; card: LeaderboardCard } | { ok: false; error: string };
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
