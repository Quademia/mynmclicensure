// lib/attempts/seal.ts
//
// The one place an attempt_items row is cut in two (03 Q6; D5). A live
// runner receives sealItem(row) — the public half and the answer group,
// never the key — and a secrets map the server fills one question at a
// time (instant mode) or not at all (a live exam); review receives every
// secret. Both lists are explicit so the boundary is grep-able: a column
// added to the row lands on neither side until someone puts it here.
//
// MyNclex's session page does the same with SEALED_ITEM_COLUMNS at its
// one server/client crossing; here the two runner pages share the loader,
// so the cut lives beside it.

import type { AttemptItem, SealedItem, SecretHalf, SecretsMap } from './types';

export function sealItem(row: AttemptItem): SealedItem {
  return {
    attempt_item_id: row.attempt_item_id,
    attempt_id: row.attempt_id,
    position: row.position,
    item_id: row.item_id,
    question_type: row.question_type,
    stem: row.stem,
    option_a: row.option_a, option_b: row.option_b, option_c: row.option_c,
    option_d: row.option_d, option_e: row.option_e, option_f: row.option_f,
    marks: row.marks,
    shuffle_options: row.shuffle_options,
    subject: row.subject,
    maintopic: row.maintopic,
    subtopic: row.subtopic,
    difficulty: row.difficulty,
    chosen: row.chosen,
    flagged: row.flagged,
    sata_checked: row.sata_checked,
    time_spent_s: row.time_spent_s,
    is_correct: row.is_correct,
    score_awarded: row.score_awarded,
    answered_utc: row.answered_utc,
    graded_utc: row.graded_utc,
  };
}

export function secretOf(row: SecretHalf): SecretHalf {
  return {
    correct: row.correct,
    rationale: row.rationale,
    rationale_img: row.rationale_img,
    fb_a: row.fb_a, fb_b: row.fb_b, fb_c: row.fb_c,
    fb_d: row.fb_d, fb_e: row.fb_e, fb_f: row.fb_f,
  };
}

/** Every row's secret half, keyed by item id — for review, and for the finish reply. */
export function secretsOf(rows: AttemptItem[]): SecretsMap {
  const map: SecretsMap = {};
  for (const row of rows) map[row.item_id] = secretOf(row);
  return map;
}
