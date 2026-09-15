// lib/attempts/scoring.ts
//
// The runner's arithmetic, transcribed from legacy runner/instant.html
// and runner/timed.html (the same functions in both): which options an
// item shows and in what order, whether a letter is correct, the score,
// and the answers_json record. Plain TypeScript with no server or client
// marker, because both halves use it: the runner in the browser for the
// live feedback and the grid, and finishAttempt() on the server, which
// recomputes the score and every is_correct from the items before
// saving (rebuild.md §12 slice 6, Sam 2026-09-13) — the browser's number
// is never trusted.

import type { Item } from '@/lib/bank/types';
import type { AnswerRecord, ChosenMap, FlagMap, Score } from './types';

export type OptionView = {
  letter: string;
  text: string;
  fb: string;
  isCorrect: boolean;
};

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export function isCorrectOption(item: Item, letter: string): boolean {
  const correct = (item.correct || '').toLowerCase();
  if (item.question_type === 'SATA') {
    return correct.split(',').map((s) => s.trim()).includes(letter);
  }
  return correct === letter;
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
export function getShuffledOptions(item: Item, attemptId: string): OptionView[] {
  const opts: OptionView[] = [];
  for (const letter of LETTERS) {
    const text = item[`option_${letter}`];
    if (!text) continue;
    opts.push({ letter, text, fb: item[`fb_${letter}`] || '', isCorrect: isCorrectOption(item, letter) });
  }
  if (!item.shuffle_options) return opts;
  return seededShuffle(opts, stringToSeed(attemptId + item.item_id));
}

// legacy getDisplayLetter: options are lettered by their shown position.
export function displayLetter(index: number, fallbackLetter: string): string {
  return index >= 0 ? String.fromCharCode(65 + index) : String(fallbackLetter || '').toUpperCase();
}

function hasAnswer(item: Item, chosen: string | string[] | undefined): boolean {
  if (item.question_type === 'SATA') return Array.isArray(chosen) && chosen.length > 0;
  return Boolean(chosen);
}

export function countAnswered(items: Item[], answers: ChosenMap): number {
  return items.filter((item) => hasAnswer(item, answers[item.item_id])).length;
}

function isCorrectAnswer(item: Item, chosen: string | string[] | null | undefined): boolean {
  const correct = (item.correct || '').toLowerCase();
  if (item.question_type === 'SATA') {
    const correctLetters = correct.split(',').map((s) => s.trim()).sort();
    const chosenLetters = Array.isArray(chosen) ? [...chosen].sort() : [];
    return JSON.stringify(correctLetters) === JSON.stringify(chosenLetters);
  }
  return typeof chosen === 'string' && chosen.length > 0 && chosen.toLowerCase() === correct;
}

// legacy computeScore: marks-weighted; SATA all-or-nothing.
export function computeScore(items: Item[], answers: ChosenMap): Score {
  let raw = 0;
  let total = 0;
  for (const item of items) {
    const marks = Number(item.marks) || 1;
    total += marks;
    if (isCorrectAnswer(item, answers[item.item_id])) raw += marks;
  }
  return { raw, total, pct: total > 0 ? Math.round((raw / total) * 100) : 0 };
}

// legacy buildAnswersJson: one record per item, in the attempt's order.
export function buildAnswersJson(
  items: Item[],
  answers: ChosenMap,
  flags: FlagMap,
  sataChecked?: FlagMap,
): AnswerRecord[] {
  return items.map((item) => {
    const chosen = answers[item.item_id] ?? null;
    const correct =
      item.question_type === 'SATA'
        ? (item.correct || '').split(',').map((s) => s.trim())
        : (item.correct || '').toLowerCase();
    const record: AnswerRecord = {
      item_id: item.item_id,
      chosen,
      correct,
      is_correct: isCorrectAnswer(item, chosen),
      flagged: Boolean(flags[item.item_id]),
      time_spent_s: null,
    };
    if (sataChecked) record.sata_checked = Boolean(sataChecked[item.item_id]);
    return record;
  });
}

// legacy hydrateAnswers: the saved records back into the three maps.
export function hydrateAnswers(answersJson: string): { answers: ChosenMap; flags: FlagMap; sataChecked: FlagMap } {
  const answers: ChosenMap = {};
  const flags: FlagMap = {};
  const sataChecked: FlagMap = {};
  try {
    const saved = JSON.parse(answersJson || '[]') as Partial<AnswerRecord>[];
    for (const a of saved) {
      if (!a.item_id) continue;
      if (a.chosen !== null && a.chosen !== undefined && a.chosen !== '') answers[a.item_id] = a.chosen;
      if (a.flagged) flags[a.item_id] = true;
      if (a.sata_checked) sataChecked[a.item_id] = true;
    }
  } catch (e) {
    console.warn('hydrateAnswers error:', e);
  }
  return { answers, flags, sataChecked };
}

// The server's recomputation at finish: the browser's records, with
// `correct` and `is_correct` replaced by what the items say, and any
// record for an item not in the attempt dropped.
export function recomputeAnswers(items: Item[], submitted: AnswerRecord[]): AnswerRecord[] {
  const byId = new Map(submitted.map((a) => [a.item_id, a]));
  const answers: ChosenMap = {};
  const flags: FlagMap = {};
  const sataChecked: FlagMap = {};
  let anySata = false;
  for (const item of items) {
    const a = byId.get(item.item_id);
    if (!a) continue;
    if (a.chosen !== null && a.chosen !== undefined && a.chosen !== '') answers[item.item_id] = a.chosen;
    if (a.flagged) flags[item.item_id] = true;
    if (a.sata_checked !== undefined) anySata = true;
    if (a.sata_checked) sataChecked[item.item_id] = true;
  }
  return buildAnswersJson(items, answers, flags, anySata ? sataChecked : undefined);
}

// legacy showScoreCard's grade line.
export function gradeFor(pct: number): { emoji: string; label: string } {
  if (pct >= 80) return { emoji: '🎉', label: 'Excellent!' };
  if (pct >= 70) return { emoji: '👍', label: 'Good effort!' };
  if (pct >= 50) return { emoji: '📖', label: 'Needs more practice' };
  return { emoji: '📚', label: 'Keep practising!' };
}
