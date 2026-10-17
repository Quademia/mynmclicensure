// lib/history/queries.ts — Learning History's reads (05.5, 05 Q12; Sam,
// 2026-10-17). Server only.
//
// A page of rows is the student's sittings newest first, twenty at a
// time, through student_attempts() (a held sitting's score empty), then
// worded here: the name, the course in full (any course status, so an
// ended or retired course never shows as a code), the mode's name, the
// day in Ghana's time, the one thing on the right, where a tap goes, and
// the three dots' lines. The lines follow the rules already built — held
// results (04.12), the review closed (04.13), sittings allowed (04.10),
// the start rules (startRefusal) — and a sitting the student can no
// longer open without a package shows its lines locked (03). The rules
// are read for the whole page at once — the papers and mocks, the
// student's sittings of them, the free test for builder quizzes outside
// a live course, the course titles — so a page costs the same few reads
// however many rows it holds. The database checks again on every start.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { readAll, slices } from '@/lib/supabase/read-all';
import { getStudentAttemptsPaginated } from '@/lib/attempts/queries';
import { reportHref, sessionHref } from '@/lib/attempts/links';
import { modeOf } from '@/lib/attempts/modes';
import type { AttemptListRow, AttemptMode } from '@/lib/attempts/types';
import { startRefusal } from '@/lib/quizzes/availability';
import { formatResultsAt, formatResultsDate, formatResultsShort, reviewClosed } from '@/lib/quizzes/results-date';
import type { Quiz } from '@/lib/quizzes/types';
import type { CourseAccessMap } from '@/lib/subscriptions/types';
import type { HistoryChunk, HistoryCourse, HistoryFigures, HistoryKind, HistoryMenuLine, HistoryRight, HistoryRow } from './types';

type QuizRules = Pick<
  Quiz,
  | 'quiz_id'
  | 'status'
  | 'published'
  | 'publish_at'
  | 'unpublish_at'
  | 'allowed_modes'
  | 'first_mode'
  | 'sittings_allowed'
  | 'results_at'
  | 'review'
  | 'review_closes_at'
>;

const RULE_COLUMNS =
  'quiz_id, status, published, publish_at, unpublish_at, allowed_modes, first_mode, sittings_allowed, results_at, review, review_closes_at';

// ── the course chips ─────────────────────────────────────────────────────
/**
 * The courses the student has sat something in, with their titles, in
 * title order — the chips. Read from the student's own sittings, so a
 * course held once and ended, or a free student's course, has its chip
 * and its name.
 */
export async function getHistoryCourses(userId: string): Promise<HistoryCourse[]> {
  const db = createServiceRoleClient();
  const { data, error } = await readAll<{ course_id: string }>((from, to) =>
    db.from('attempts').select('course_id').eq('user_id', userId).order('attempt_id').range(from, to),
  );
  if (error) {
    console.error('getHistoryCourses:', userId, error);
    return [];
  }
  const ids = [...new Set(data.map((r) => r.course_id).filter(Boolean))];
  const titles = await courseTitles(ids);
  return ids
    .map((course_id) => ({ course_id, title: titles.get(course_id) || course_id }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function courseTitles(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const db = createServiceRoleClient();
  for (const part of slices(ids)) {
    const { data, error } = await db.from('courses').select('course_id, title').in('course_id', part);
    if (error) {
      console.error('courseTitles:', error);
      continue;
    }
    for (const r of (data ?? []) as { course_id: string; title: string }[]) out.set(r.course_id, r.title);
  }
  return out;
}

// ── the figures ──────────────────────────────────────────────────────────
const NO_FIGURES: HistoryFigures = { sittings: 0, averagePct: null, bestPct: null, papers: 0, mocks: 0, builder: 0, free: 0 };

/** The figures over the whole history, or one course's — one trip (05 Q12). */
export async function getHistoryFigures(userId: string, courseId: string): Promise<HistoryFigures> {
  // A GET: no null in its arguments (it would arrive as 'null'), so "all
  // courses" leaves the course out.
  const { data, error } = await createServiceRoleClient().rpc(
    'student_history_figures',
    courseId ? { p_user_id: userId, p_course_id: courseId } : { p_user_id: userId },
    { get: true },
  );
  if (error) {
    console.error('getHistoryFigures:', userId, error);
    return NO_FIGURES;
  }
  const r = ((data ?? []) as Record<string, number | string | null>[])[0];
  if (!r) return NO_FIGURES;
  const pct = (v: number | string | null) => (v == null ? null : Math.round(Number(v)));
  return {
    sittings: Number(r.sittings) || 0,
    averagePct: pct(r.average_pct),
    bestPct: pct(r.best_pct),
    papers: Number(r.papers) || 0,
    mocks: Number(r.mocks) || 0,
    builder: Number(r.builder) || 0,
    free: Number(r.free) || 0,
  };
}

// ── a page of rows ───────────────────────────────────────────────────────
/** One page of the student's sittings, newest first, worded for the list. */
export async function getHistoryChunk(
  userId: string,
  access: CourseAccessMap,
  courseId: string,
  page: number,
): Promise<HistoryChunk> {
  const { attempts, total } = await getStudentAttemptsPaginated(userId, { courseId, status: '', mode: '', search: '' }, page);
  if (!attempts.length) return { rows: [], total };

  const quizIds = [...new Set(attempts.map((a) => a.quiz_id).filter((id): id is string => Boolean(id)))];
  const outsideBuilder = attempts.filter((a) => !a.quiz_id && !access[a.course_id]).map((a) => a.attempt_id);

  const [papers, mocks, sittings, free, titles] = await Promise.all([
    quizRules('quizzes', quizIds),
    quizRules('mock_quizzes', quizIds),
    sittingsOf(userId, quizIds),
    freeSittings(outsideBuilder, attempts),
    courseTitles([...new Set(attempts.map((a) => a.course_id))]),
  ]);

  const now = new Date();
  const rows = attempts.map((a) =>
    wordRow(a, {
      kind: a.quiz_id ? (mocks.has(a.quiz_id) ? 'mock' : 'paper') : 'builder',
      quiz: a.quiz_id ? (mocks.get(a.quiz_id) ?? papers.get(a.quiz_id) ?? null) : null,
      sittings: a.quiz_id ? (sittings.get(a.quiz_id) ?? { count: 0, going: false }) : null,
      live: Boolean(access[a.course_id]),
      free: free.has(a.attempt_id),
      courseTitle: titles.get(a.course_id) || a.course_id,
      now,
    }),
  );
  return { rows, total };
}

async function quizRules(table: 'quizzes' | 'mock_quizzes', ids: string[]): Promise<Map<string, QuizRules>> {
  const out = new Map<string, QuizRules>();
  if (!ids.length) return out;
  const { data, error } = await createServiceRoleClient().from(table).select(RULE_COLUMNS).in('quiz_id', ids);
  if (error) console.error('quizRules:', table, error);
  for (const r of (data ?? []) as unknown as QuizRules[]) out.set(r.quiz_id, r);
  return out;
}

/** The student's sittings of each paper or mock, and whether one is going (04.10). */
async function sittingsOf(userId: string, quizIds: string[]): Promise<Map<string, { count: number; going: boolean }>> {
  const out = new Map<string, { count: number; going: boolean }>();
  if (!quizIds.length) return out;
  const { data, error } = await createServiceRoleClient()
    .from('attempts')
    .select('quiz_id, status')
    .eq('user_id', userId)
    .in('quiz_id', quizIds);
  if (error) console.error('sittingsOf:', userId, error);
  for (const r of (data ?? []) as { quiz_id: string; status: string }[]) {
    const s = out.get(r.quiz_id) ?? { count: 0, going: false };
    s.count += 1;
    if (r.status === 'in_progress') s.going = true;
    out.set(r.quiz_id, s);
  }
  return out;
}

/**
 * Which of these builder sittings are free practice — every question a
 * published question of its course in the Free pool, isFreeSitting()'s
 * test for a page at once. Asked only for sittings outside a live course,
 * the one case where it decides what opens (03, F1).
 */
async function freeSittings(attemptIds: string[], attempts: AttemptListRow[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!attemptIds.length) return out;
  const db = createServiceRoleClient();
  const { data: items, error } = await readAll<{ attempt_id: string; item_id: string }>((from, to) =>
    db.from('attempt_items').select('attempt_id, item_id').in('attempt_id', attemptIds).order('attempt_item_id').range(from, to),
  );
  if (error) {
    console.error('freeSittings items:', error);
    return out;
  }
  const itemIds = [...new Set(items.map((r) => r.item_id))];
  const freeOf = new Map<string, string>(); // item → its course, for the free and published ones
  for (const part of slices(itemIds)) {
    const { data, error: bankError } = await db
      .from('question_bank')
      .select('item_id, course_id')
      .eq('pool', 'free')
      .eq('is_published', true)
      .in('item_id', part);
    if (bankError) {
      console.error('freeSittings bank:', bankError);
      return out;
    }
    for (const r of (data ?? []) as { item_id: string; course_id: string }[]) freeOf.set(r.item_id, r.course_id);
  }
  const courseOf = new Map(attempts.map((a) => [a.attempt_id, a.course_id]));
  const byAttempt = new Map<string, string[]>();
  for (const r of items) byAttempt.set(r.attempt_id, [...(byAttempt.get(r.attempt_id) ?? []), r.item_id]);
  for (const [attemptId, ids] of byAttempt) {
    if (ids.length && ids.every((id) => freeOf.get(id) === courseOf.get(attemptId))) out.add(attemptId);
  }
  return out;
}

// ── wording one row ──────────────────────────────────────────────────────
type RowFacts = {
  kind: HistoryKind;
  quiz: QuizRules | null;
  sittings: { count: number; going: boolean } | null;
  /** A live grant for the sitting's course. */
  live: boolean;
  /** A builder quiz of free questions only — open without a grant (03). */
  free: boolean;
  courseTitle: string;
  now: Date;
};

const NAME_FALLBACK: Record<HistoryKind, string> = { paper: 'Practice paper', mock: 'Mock exam', builder: 'Quiz' };

function wordRow(a: AttemptListRow, f: RowFacts): HistoryRow {
  const status = a.status;
  const held = status === 'completed' && a.held === true && Boolean(a.results_at);
  // What the student may open without a package: everything while the
  // course is live, a free sitting always (03, F1). The report refuses
  // the rest today (the review's check), so the row says so first.
  const opens = f.live || f.free;

  let right: HistoryRight;
  let href: string | null = null;
  const menu: HistoryMenuLine[] = [];

  if (status === 'in_progress') {
    // 03: a sitting left unfinished can still be finished, grant or none.
    right = { kind: 'resume' };
    href = sessionHref(a.attempt_id);
    menu.push({ kind: 'resume', href }, { kind: 'abandon', sittingsAllowed: f.quiz?.sittings_allowed ?? null });
    return finish();
  }

  if (status === 'completed') {
    if (held) {
      right = { kind: 'held', text: `Results ${formatResultsShort(a.results_at as string)}` };
      href = opens ? reportHref(a.attempt_id) : null;
      menu.push({ kind: 'note', text: `Results on ${formatResultsAt(a.results_at as string)}`, icon: 'hourglass' });
    } else {
      right = { kind: 'score', pct: Math.round(Number(a.score_pct) || 0) };
      if (opens) {
        href = reportHref(a.attempt_id);
        menu.push({ kind: 'report', href });
        if (a.review_closed) {
          menu.push({ kind: 'note', text: reviewClosedNote(a.review, a.review_closes_at), icon: 'lock' });
        } else {
          menu.push({ kind: 'review', href: sessionHref(a.attempt_id) });
        }
      } else {
        menu.push({ kind: 'locked', label: 'See your report' }, { kind: 'locked', label: 'Review answers' });
      }
    }
  } else {
    // abandoned: nothing to open; Retake where allowed
    right = { kind: 'abandoned' };
  }

  const retake = retakeLine(a, f, opens);
  if (retake) menu.push(retake);
  return finish();

  function finish(): HistoryRow {
    return {
      attemptId: a.attempt_id,
      name: a.display_label || NAME_FALLBACK[f.kind],
      courseTitle: f.courseTitle,
      modeName: a.mode ? modeOf(a.mode).name : '',
      day: dayOf(a.ts_iso, f.now),
      right,
      href,
      menu,
    };
  }
}

function reviewClosedNote(review: string | null | undefined, closesAt: string | null | undefined): string {
  if (review === 'until' && closesAt) return `Review closed on ${formatResultsDate(closesAt)}`;
  return 'The answers are not shown';
}

/** Retake's line: open, told in grey with its reason, locked, or none. */
function retakeLine(a: AttemptListRow, f: RowFacts, opens: boolean): HistoryMenuLine | null {
  if (!opens) return f.kind === 'builder' || f.quiz ? { kind: 'locked', label: 'Retake' } : null;
  if (f.kind === 'builder') {
    // A free sitting outside a grant retakes in a Study mode only (03).
    if (!f.live && a.mode && modeOf(a.mode).group === 'exam') return null;
    return { kind: 'retake' };
  }
  const quiz = f.quiz;
  if (!quiz || !a.mode) return null;
  const s = f.sittings ?? { count: 0, going: false };
  if (quiz.sittings_allowed != null && s.count >= quiz.sittings_allowed) {
    return { kind: 'note', text: 'No sittings left', icon: 'lock' };
  }
  if (s.going) return { kind: 'note', text: 'A sitting is in progress', icon: 'hourglass' };
  const refusal = startRefusal(quiz as Parameters<typeof startRefusal>[0], a.mode as AttemptMode, f.now);
  if (!refusal) return { kind: 'retake' };
  const noun = f.kind === 'mock' ? 'mock' : 'paper';
  if (refusal.startsWith('Until its results')) {
    return { kind: 'note', text: `Retake opens on ${formatResultsDate(quiz.results_at as string)}`, icon: 'hourglass' };
  }
  if (a.mode === 'UNTIMED_LEARNING' && reviewClosed(quiz.review, quiz.review_closes_at, f.now)) {
    return { kind: 'note', text: 'Learning closed with the review', icon: 'lock' };
  }
  if (refusal.startsWith('This quiz is not open')) return { kind: 'note', text: `This ${noun} is closed`, icon: 'lock' };
  return null;
}

/** "Today", "Yesterday", "14 Oct", or "14 Oct 2025" in another year — Ghana's time (UTC). */
function dayOf(iso: string | null | undefined, now: Date): string {
  if (!iso) return '';
  const d = new Date(iso);
  const key = (x: Date) => x.toISOString().slice(0, 10);
  if (key(d) === key(now)) return 'Today';
  if (key(d) === key(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}
