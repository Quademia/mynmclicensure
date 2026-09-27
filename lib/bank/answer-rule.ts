// lib/bank/answer-rule.ts
//
// 08 B8 (Sam, 2026-09-27): what a question's correct answer must be,
// written once for the three places one is saved — the editor's save,
// the CSV report the admin reads before importing, and the import
// itself. Pure, no database, so the browser and the server say the same
// words.
//
// Why: the runner shows every option that has text, whatever the type,
// and grades by letter. So an answer naming an empty option ("e" with no
// option E), or one that is not a letter ("a & c" on a multiple-choice
// question), is a question no student can get right; and a True / False
// question with text in C–F is served with six options. Before B8 the
// editor, the importer and the database took all of these.

import { OPTION_LETTERS, type OptionLetter } from './types';

/** A question's option texts by letter, as the editor or a CSV row holds them. */
export type OptionTexts = Partial<Record<OptionLetter, string | null | undefined>>;

export type AnswerCheck = { ok: true; correct: string } | { ok: false; reason: string };

const ONE_ANSWER: Record<string, string> = { MCQ: 'a multiple-choice', TF: 'a True / False' };

function isLetter(s: string): s is OptionLetter {
  return (OPTION_LETTERS as readonly string[]).includes(s);
}

function hasText(options: OptionTexts, letter: OptionLetter): boolean {
  return String(options[letter] ?? '').trim() !== '';
}

/**
 * One question's answer, checked against its type and its options. On
 * success `correct` is the answer as it is stored: lower case, no spaces,
 * each letter once ("b"; "a,c,e" for SATA). On failure `reason` says what
 * is wrong, in words that follow "Row 7: " in the import's report; the
 * editor's save opens a sentence with it (asSentence).
 */
export function checkAnswer(type: string, correctIn: string, options: OptionTexts): AnswerCheck {
  const raw = String(correctIn ?? '').trim();
  const parts = raw.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return { ok: false, reason: 'the correct answer is missing' };

  if (!parts.every(isLetter)) {
    return {
      ok: false,
      reason: type === 'SATA'
        ? `the correct answer "${raw}" is not letters from A to F separated by commas, such as "a,c,e"`
        : `the correct answer "${raw}" is not a letter from A to F`,
    };
  }
  const letters = [...new Set(parts)];
  if (type !== 'SATA' && letters.length > 1) {
    return { ok: false, reason: `${ONE_ANSWER[type] ?? 'this'} question has one correct answer, not "${raw}"` };
  }

  if (type === 'TF') {
    if (letters[0] !== 'a' && letters[0] !== 'b') {
      return { ok: false, reason: 'a True / False answer must be A (True) or B (False)' };
    }
    const extra = OPTION_LETTERS.find((l) => l !== 'a' && l !== 'b' && hasText(options, l));
    if (extra) {
      return { ok: false, reason: `a True / False question has options A and B only, but option ${extra.toUpperCase()} has text` };
    }
    if (!hasText(options, 'a') || !hasText(options, 'b')) {
      return { ok: false, reason: 'a True / False question needs text in both option A and option B' };
    }
  }

  const empty = letters.find((l) => !hasText(options, l));
  if (empty) {
    const L = empty.toUpperCase();
    return { ok: false, reason: `the correct answer is ${L}, but option ${L} is empty` };
  }
  return { ok: true, correct: letters.join(',') };
}

/** A reason as the editor's toast shows it: a capital and a full stop. */
export function asSentence(reason: string): string {
  return reason.charAt(0).toUpperCase() + reason.slice(1) + '.';
}
