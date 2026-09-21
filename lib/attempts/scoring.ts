// lib/attempts/scoring.ts
//
// The runner's arithmetic, transcribed from legacy runner/instant.html
// and runner/timed.html (the same functions in both): which options an
// item shows and in what order, whether a letter is correct, the score
// the browser shows before submit, and the attempt's rows back into the
// runner's maps. Plain TypeScript with no server or client marker. Since
// 03 Q5 the score that counts is the database's — finish_attempt()
// grades every row in SQL (grade_answer(), the same rule as
// isCorrectAnswer here) — and the browser's number is never written.

import type { ChosenMap, FlagMap, SealedItem, SecretHalf } from './types';

// An option as shown: its letter and text. The feedback and the
// correctness are the secret half's, looked up at render (Q6).
export type OptionView = {
  letter: string;
  text: string;
};

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

/** Is `letter` one of the correct options? `correct` is the secret half's key. */
export function isCorrectOption(questionType: string, correct: string | null | undefined, letter: string): boolean {
  const key = (correct || '').toLowerCase();
  if (questionType === 'SATA') {
    return key.split(',').map((s) => s.trim()).includes(letter);
  }
  return key === letter;
}

/** The secret half's feedback line for a letter, or ''. */
export function optionFeedback(secret: SecretHalf | null | undefined, letter: string): string {
  if (!secret) return '';
  const key = `fb_${letter}` as keyof SecretHalf;
  return String(secret[key] || '');
}

// legacy stringToSeed: a 32-bit string hash, Math.imul(31, h) + code.
export function stringToSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// legacy seededShuffle: Fisher–Yates driven by a linear congruential
// generator, so the same seed always gives the same order.
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// legacy getShuffledOptions: the item's filled options, shuffled when the
// item says so, with attempt_id + item_id as the seed — the same order on
// every render and every resume of this attempt.
export function getShuffledOptions(item: SealedItem, attemptId: string): OptionView[] {
  const opts: OptionView[] = [];
  for (const letter of LETTERS) {
    const text = item[`option_${letter}`];
    if (!text) continue;
    opts.push({ letter, text });
  }
  if (!item.shuffle_options) return opts;
  return seededShuffle(opts, stringToSeed(attemptId + item.item_id));
}

// legacy getDisplayLetter: options are lettered by their shown position.
export function displayLetter(index: number, fallbackLetter: string): string {
  return index >= 0 ? String.fromCharCode(65 + index) : String(fallbackLetter || '').toUpperCase();
}

function hasAnswer(item: Pick<SealedItem, 'question_type'>, chosen: string | string[] | undefined): boolean {
  if (item.question_type === 'SATA') return Array.isArray(chosen) && chosen.length > 0;
  return Boolean(chosen);
}

export function countAnswered(items: SealedItem[], answers: ChosenMap): number {
  return items.filter((item) => hasAnswer(item, answers[item.item_id])).length;
}

// The browser's grading of one answer against a key it has been handed
// (the grid's colouring in review, before the server's is_correct is
// consulted) — the same rule as grade_answer() in SQL, which is the one
// that counts. There is no browser-side score any more: the score card
// shows what finish_attempt() returned or the header stores.
export function isCorrectAnswer(questionType: string, correct: string | null | undefined, chosen: string | string[] | null | undefined): boolean {
  const key = (correct || '').toLowerCase();
  if (questionType === 'SATA') {
    const correctLetters = key.split(',').map((s) => s.trim()).filter(Boolean).sort();
    const chosenLetters = Array.isArray(chosen) ? [...chosen].sort() : [];
    return JSON.stringify(correctLetters) === JSON.stringify(chosenLetters);
  }
  return typeof chosen === 'string' && chosen.length > 0 && chosen.toLowerCase() === key;
}

// The stored `chosen` (a letter, or a comma list for SATA — the bank's
// own convention for `correct`) and the runner's value for it.
export function chosenToStored(v: string | string[] | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).join(',') : String(v).trim();
  return s || null;
}

function chosenFromStored(item: Pick<SealedItem, 'question_type'>, stored: string | null): string | string[] | null {
  if (!stored) return null;
  if (item.question_type === 'SATA') return stored.split(',').map((s) => s.trim()).filter(Boolean);
  return stored;
}

// The attempt's rows back into the runner's three maps (03 Q5; legacy
// hydrateAnswers read them from answers_json).
export function hydrateFromRows(items: SealedItem[]): { answers: ChosenMap; flags: FlagMap; sataChecked: FlagMap } {
  const answers: ChosenMap = {};
  const flags: FlagMap = {};
  const sataChecked: FlagMap = {};
  for (const row of items) {
    const chosen = chosenFromStored(row, row.chosen);
    if (chosen !== null && (!Array.isArray(chosen) || chosen.length > 0)) answers[row.item_id] = chosen;
    if (row.flagged) flags[row.item_id] = true;
    if (row.sata_checked) sataChecked[row.item_id] = true;
  }
  return { answers, flags, sataChecked };
}

// legacy showScoreCard's grade line.
export function gradeFor(pct: number): { emoji: string; label: string } {
  if (pct >= 80) return { emoji: '🎉', label: 'Excellent!' };
  if (pct >= 70) return { emoji: '👍', label: 'Good effort!' };
  if (pct >= 50) return { emoji: '📖', label: 'Needs more practice' };
  return { emoji: '📚', label: 'Keep practising!' };
}
