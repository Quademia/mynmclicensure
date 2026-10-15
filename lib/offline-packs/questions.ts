// lib/offline-packs/questions.ts — a pack's question as the offline player
// plays it and the phone keeps it (07.3, 07.4; Sam, 2026-10-15): the stem,
// its options, the answer and the topic — never an explanation (07.6).
// One shape and one mapping for the online player's page and the copy a
// phone saves, so the two never drift. No server or browser code here:
// both sides import it.

import type { OfflinePackItem } from './types';

export type PackQuestion = {
  id: string;
  question_type: string;
  stem: string;
  options: { letter: string; text: string }[];
  correct: string;
  topic: string | null;
};

/** The two ways a pack is practised (07.4), as its Practise asks them, online and offline. */
export type PackWay = 'go' | 'end';
export const PACK_WAYS: readonly { way: PackWay; name: string; blurb: string }[] = [
  { way: 'go', name: 'Answer as you go', blurb: 'See the right answer after each question.' },
  { way: 'end', name: 'Answers at the end', blurb: 'Answer them all, then see your score and each answer.' },
];

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export function toPackQuestions(items: OfflinePackItem[]): PackQuestion[] {
  return items.map((it) => ({
    id: String(it.pack_item_id),
    question_type: it.question_type,
    stem: it.stem,
    options: LETTERS.flatMap((l) => {
      const text = it[`option_${l}`];
      return text ? [{ letter: l, text: String(text) }] : [];
    }),
    correct: String(it.correct || ''),
    topic: it.maintopic || null,
  }));
}
