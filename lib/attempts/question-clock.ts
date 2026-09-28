// lib/attempts/question-clock.ts — time per question (03 Q11, Sam
// 2026-09-29): the engaged seconds on each question of a live sitting,
// for the attempt report (Q10) to show. MyNclex's measuring
// (lib/practice/runner/time-tracker there): the clock runs only while a
// question is on screen AND the page is in view — it pauses when the
// student switches app, locks the phone or changes tab — and a return to
// a question adds to its total. Sam's three rulings: pause when away;
// one unbroken stretch counts at most QUESTION_STRETCH_CAP_S (10 min),
// so a screen left on cannot record an hour; Learning's reading of the
// rationale is time on that question.
//
// Where it differs from MyNclex, for slow connections: MyNclex sends
// each stretch as "+N seconds" in a request of its own, lost if that
// request fails. Here the runner sends each question's RUNNING TOTAL
// with a save it is making anyway (save_answers writes time_spent_s as
// given), so a failed save is healed by the next one and no request is
// added in ordinary use.
//
// Plain data and functions, no browser: the caller passes a monotonic
// timestamp (performance.now(), ms) on every call, so the rules can be
// run from a script with made-up times. The runner keeps one of these in
// a ref and mutates it in handlers and effects.

import { QUESTION_STRETCH_CAP_S, TIME_SPENT_MAX_S } from './types';

const CAP_MS = QUESTION_STRETCH_CAP_S * 1000;

export type QuestionClock = {
  /** Engaged ms per question, from the stored seconds on. */
  totals: Map<string, number>;
  /** Whole seconds last saved per question. */
  sent: Map<string, number>;
  /** Questions whose time is no longer sent: Sequential's passed ones,
   *  which save_answers refuses. */
  closed: Set<string>;
  /** The questions on screen (one, at one question a page). */
  active: string[];
  /** Whether the page is in view. */
  visible: boolean;
  /** When the current unbroken stretch began; null while paused. */
  stretchStart: number | null;
  /** Ms of the current stretch already added to the totals. */
  stretchCounted: number;
};

export function createClock(
  rows: { item_id: string; time_spent_s: number | null; closed?: boolean }[],
  visible: boolean,
): QuestionClock {
  const totals = new Map<string, number>();
  const sent = new Map<string, number>();
  const closed = new Set<string>();
  for (const r of rows) {
    const s = Math.max(0, Math.floor(Number(r.time_spent_s) || 0));
    totals.set(r.item_id, s * 1000);
    sent.set(r.item_id, s);
    if (r.closed) closed.add(r.item_id);
  }
  return { totals, sent, closed, active: [], visible, stretchStart: null, stretchCounted: 0 };
}

/** Add the open stretch's time so far to the questions on screen, shared
 *  evenly when a page shows several; the stretch stays open. */
export function bank(clock: QuestionClock, now: number): void {
  if (clock.stretchStart === null || clock.active.length === 0) return;
  const counted = Math.min(Math.max(0, now - clock.stretchStart), CAP_MS);
  const add = counted - clock.stretchCounted;
  if (add <= 0) return;
  clock.stretchCounted = counted;
  const share = add / clock.active.length;
  for (const id of clock.active) clock.totals.set(id, (clock.totals.get(id) ?? 0) + share);
}

function openStretch(clock: QuestionClock, now: number): void {
  clock.stretchStart = clock.visible && clock.active.length > 0 ? now : null;
  clock.stretchCounted = 0;
}

/** The questions on screen changed (a page turn, Sequential's move, the
 *  sitting starting or ending): bank the old stretch, open a new one. */
export function setActive(clock: QuestionClock, ids: string[], now: number): void {
  if (ids.length === clock.active.length && ids.every((id, i) => id === clock.active[i])) return;
  bank(clock, now);
  clock.active = [...ids];
  openStretch(clock, now);
}

/** The page went out of view. */
export function pause(clock: QuestionClock, now: number): void {
  bank(clock, now);
  clock.visible = false;
  clock.stretchStart = null;
  clock.stretchCounted = 0;
}

/** The page came back into view: a new stretch on the same questions. */
export function resume(clock: QuestionClock, now: number): void {
  if (clock.visible) return;
  clock.visible = true;
  openStretch(clock, now);
}

/** Stop sending a question's time (Sequential, once moved past). */
export function close(clock: QuestionClock, itemId: string): void {
  clock.closed.add(itemId);
}

/** Each open question's whole-second total that differs from what was
 *  last saved, capped at TIME_SPENT_MAX_S. Banks first; not marked sent
 *  until the save succeeds (markSent), so a failed save sends it again. */
export function unsent(clock: QuestionClock, now: number): { item_id: string; time_spent_s: number }[] {
  bank(clock, now);
  const out: { item_id: string; time_spent_s: number }[] = [];
  for (const [id, ms] of clock.totals) {
    if (clock.closed.has(id)) continue;
    const s = Math.min(TIME_SPENT_MAX_S, Math.floor(ms / 1000));
    if (s !== clock.sent.get(id)) out.push({ item_id: id, time_spent_s: s });
  }
  return out;
}

export function markSent(clock: QuestionClock, rows: { item_id: string; time_spent_s: number }[]): void {
  for (const r of rows) clock.sent.set(r.item_id, r.time_spent_s);
}

/** The whole sitting's engaged seconds — the sum of the questions' saved
 *  whole seconds, the open stretch banked to now, so it equals what a
 *  report adding up time_spent_s will find. An untimed sitting's time
 *  taken (Sam, 2026-09-29): every visit of a resumed sitting, none of the
 *  time away. */
export function sittingSeconds(clock: QuestionClock, now: number): number {
  bank(clock, now);
  let s = 0;
  for (const ms of clock.totals.values()) s += Math.min(TIME_SPENT_MAX_S, Math.floor(ms / 1000));
  return s;
}
