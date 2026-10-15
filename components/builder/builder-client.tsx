// components/builder/builder-client.tsx — the Quiz Builder (04.4), and
// since 07.2 the pack builder too (Sam, 2026-10-15: the pack builder is the
// Quiz Builder with a pack's extras — step 4 Count & name, no mode; the
// count to the pack limit; the allowance line; Make pack on the Review
// step; its own Recent setups). `kind` says which; the door behind each
// is its own (lib/attempts/builder-door, lib/offline-packs/door).
//
// The Quiz Builder (04.4). Sam, 2026-10-11, later: the old five-step wizard's look
// back, on the new builder's rules — 1 Course & selection mode · 2 Topics
// or Keyword · 3 Filters · 4 Count & mode · 5 Review & build, the quiz
// built from the Review step only.
//
// The look is the legacy wizard's (slice 6a, the page before 04.4); what
// the student may build from is the builder's door on the server
// (lib/attempts/builder-door) — the whole bank or the free questions, the
// modes open, a trial's quizzes left — asked again by every Server Action
// here and held by the database at Start. Sam's rulings on the old look
// (a–g): the status line above the circles; exam modes shown locked on
// the free questions; step 3 "Filters" with New to me / Got wrong before;
// Concept becomes Keyword, without the old subtopic list; Build on the
// Review step only; Recent setups (5) kept per student on the device; the
// slider from 5.
//
// The course's light rows load once on pick, each marked seen / got
// wrong; every count after that is worked out here, so a tap costs no
// request on a weak connection. The keyword alone goes to the server (the
// question text never reaches the page). A dropped connection says so and
// offers Try again, as the runner does — the page never freezes.

'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { loadQuizBuilderCourse, searchQuizBuilderKeyword, startQuizBuilderQuiz } from '@/lib/attempts/actions';
import { loadPackBuilderCourse, makeOfflinePack, searchPackBuilderKeyword } from '@/lib/offline-packs/actions';
import { sessionHref } from '@/lib/attempts/links';
import { MODES, MODE_GROUPS, MODE_ORDER, modeOf } from '@/lib/attempts/modes';
import { BUILDER_MIN_QUESTIONS, CONCEPT_SEARCH_DELAY_MS, type AttemptMode, type BuilderDoorCourse, type QuizBuilderItem } from '@/lib/attempts/types';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { Toast } from '@/lib/toast/toast';
import { Banner, PackBanner } from './builder-parts';

type Way = 'topics' | 'keyword';
type Which = 'all' | 'new' | 'wrong';

const MIN = BUILDER_MIN_QUESTIONS;
const COUNT_DEFAULT = 20;
const NOT_SET = 'Not set';
const PACKAGES_HREF = '/student/upgrade';
const NO_CONNECTION_LOAD = 'Could not load the questions. Please check your connection.';
const NO_CONNECTION_SEARCH = 'Could not search. Please check your connection.';
const NO_CONNECTION_BUILD = 'Could not build your quiz. Please check your connection and try again.';
const NO_CONNECTION_MAKE = 'Could not make your pack. Please check your connection and try again.';

function stepNames(way: Way, pack: boolean) {
  const what = way === 'keyword' ? 'Keyword' : 'Topics';
  const count = pack ? 'Count & name' : 'Count & mode';
  const last = pack ? 'Review & make' : 'Review & build';
  return {
    long: ['Course & selection mode', what, 'Filters', count, last],
    short: ['Course & mode', what, 'Filters', count, last],
  };
}

const WHICH: { id: Which; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New to me' },
  { id: 'wrong', label: 'Got wrong before' },
];
const DIFF_ORDER = ['Easy', 'Moderate', 'Hard'];
const TYPE_LABEL: Record<string, string> = {
  MCQ: 'Single answer',
  SATA: 'Select all that apply',
  TF: 'True / False',
  'True/False': 'True / False',
};
const typeLabel = (t: string) => TYPE_LABEL[t] || t;

// The mode card's badge colour: Study's two teal, Exam's two amber.
const MODE_BADGE: Record<AttemptMode, string> = {
  UNTIMED_LEARNING: 'badge-instant',
  UNTIMED_TEST: 'badge-instant',
  TIMED_FREE_NAV: 'badge-timed',
  TIMED_SEQUENTIAL: 'badge-timed',
};

// ── Recent setups, on this device, for this student (browser storage
// through useSyncExternalStore — AGENTS.md: never read in render or set
// from an effect; keyed by the student, since phones are shared) ──
type RecentSetup = {
  courseId: string;
  way: Way;
  useAllTopics: boolean;
  topics: string[];
  word: string;
  kwTopics: string[];
  which: Which;
  diffs: string[];
  types: string[];
  count: number;
  mode: AttemptMode;
  savedAt: number;
};

const RECENT_KEY = 'qa_builder_recent_v2';
// 07.2: the pack builder keeps its own
const PACK_RECENT_KEY = 'qa_pack_recent_v1';
const RECENT_MAX = 5;
const recentKeyOf = (base: string, userKey: string) => `${base}:${userKey}`;
const recentListeners = new Set<() => void>();

function subscribeRecent(onChange: () => void): () => void {
  recentListeners.add(onChange);
  return () => {
    recentListeners.delete(onChange);
  };
}
function readRecent(base: string, userKey: string): string {
  try {
    return window.localStorage.getItem(recentKeyOf(base, userKey)) || '';
  } catch {
    return '';
  }
}
function recentOnServer(): string {
  return '';
}
function parseRecent(raw: string): RecentSetup[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as RecentSetup[];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.courseId === 'string') : [];
  } catch {
    return [];
  }
}
/** The newest first; one per course and selection mode, as the old wizard kept them. */
function saveRecent(base: string, userKey: string, entry: RecentSetup): void {
  try {
    const rest = parseRecent(readRecent(base, userKey)).filter((x) => !(x.courseId === entry.courseId && x.way === entry.way));
    window.localStorage.setItem(recentKeyOf(base, userKey), JSON.stringify([entry, ...rest].slice(0, RECENT_MAX)));
  } catch {
    /* storage blocked — Recent setups simply does not show */
  }
  for (const onChange of recentListeners) onChange();
}
function list(v: unknown): string[] {
  return [...new Set((Array.isArray(v) ? v : []).map((x) => String(x || '').trim()).filter(Boolean))];
}

// ── helpers ──
function topicOf(i: QuizBuilderItem): string {
  return String(i.maintopic || '').trim() || NOT_SET;
}
function countBy(items: QuizBuilderItem[], key: (i: QuizBuilderItem) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) || 0) + 1);
  return m;
}
/** A to Z, "Not set" last — the old wizard's topic order. */
function byName(a: string, b: string): number {
  return (a === NOT_SET ? 1 : 0) - (b === NOT_SET ? 1 : 0) || a.localeCompare(b);
}
function toggleIn(items: string[], v: string): string[] {
  return items.includes(v) ? items.filter((x) => x !== v) : [...items, v];
}
function shortList(names: string[]): string {
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}
function questions(n: number): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? 'question' : 'questions'}`;
}
function minutesText(m: number): string {
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
}
/** The clock, read from a handler only (the React compiler refuses a read in render). */
function nowMs(): number {
  return Date.now();
}
// Fisher–Yates; called from Build's handler, never in render.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A topic tile — a dot, the name, its count in a small pill. */
function TopicTile({ label, count, picked, onClick }: { label: string; count: number; picked: boolean; onClick: () => void }) {
  return (
    <button type="button" className={picked ? 'topic-chip picked' : 'topic-chip'} aria-pressed={picked} onClick={onClick}>
      <span className="dot" aria-hidden="true" />
      <span className="topic-chip-name">{label}</span>
      <span className="topic-chip-count">{count.toLocaleString('en-GB')}</span>
    </button>
  );
}

/** A picked topic under the box, with its × (the old wizard's chip row). */
function PickedChips({ names, onRemove }: { names: string[]; onRemove: (name: string) => void }) {
  if (!names.length) return null;
  return (
    <div className="chips-row">
      {names.map((t) => (
        <span key={t} className="picked-chip">
          {t}
          <button type="button" className="picked-chip-remove" aria-label={`Remove ${t}`} onClick={() => onRemove(t)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function QuizBuilderClient({
  courses,
  maxQuestions,
  minutesPerQuestion,
  initialCourseId,
  initialTopic,
  userKey,
  kind = 'quiz',
}: {
  courses: BuilderDoorCourse[];
  maxQuestions: number;
  minutesPerQuestion: number;
  initialCourseId: string;
  /** The report's and the dashboard's "Practise this topic" — ticked, the wizard on its Topics step. */
  initialTopic: string;
  /** The student's own id — Recent setups are kept per student on a device. */
  userKey: string;
  /** 07.2: the Quiz Builder, or the pack builder (the same page with a pack's extras). */
  kind?: 'quiz' | 'pack';
}) {
  const router = useRouter();
  const pack = kind === 'pack';
  const recentBase = pack ? PACK_RECENT_KEY : RECENT_KEY;

  // ── what the student chose ──
  const [step, setStep] = useState(() => (initialTopic ? 1 : 0));
  const [courseId, setCourseId] = useState(() => initialCourseId || (courses.length === 1 ? courses[0].course_id : ''));
  const [way, setWay] = useState<Way>('topics');
  const [useAllTopics, setUseAllTopics] = useState(false);
  const [topics, setTopics] = useState<string[]>(() => (initialTopic ? [initialTopic] : []));
  const [topicFind, setTopicFind] = useState('');
  const [word, setWord] = useState('');
  const [kwTopics, setKwTopics] = useState<string[]>([]);
  const [which, setWhich] = useState<Which>('all');
  const [diffs, setDiffs] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [count, setCount] = useState(COUNT_DEFAULT);
  // the number box while the student types in it; the count itself is clamped
  const [countText, setCountText] = useState<string | null>(null);
  const [mode, setMode] = useState<AttemptMode>('UNTIMED_LEARNING');
  const [examNote, setExamNote] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  // 07.2: the pack's name, as typed; empty takes the suggestion
  const [packName, setPackName] = useState('');

  // ── the course's rows, the keyword's ids, the build ──
  const [items, setItems] = useState<QuizBuilderItem[]>([]);
  const [loadedCourse, setLoadedCourse] = useState('');
  const [loadFailed, setLoadFailed] = useState('');
  const [kw, setKw] = useState<{ courseId: string; word: string; ids: Set<string> } | null>(null);
  const [kwFailed, setKwFailed] = useState<{ courseId: string; word: string; message: string } | null>(null);
  const [building, setBuilding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const course = courses.find((c) => c.course_id === courseId) ?? null;
  const free = course?.pool === 'free';
  // Before a course is picked, the status line speaks for the first course that has one.
  const bannerCourse = course ?? courses.find((c) => c.reason !== 'paid') ?? null;
  const names = stepNames(way, pack);

  const recentRaw = useSyncExternalStore(subscribeRecent, () => readRecent(recentBase, userKey), recentOnServer);
  const recent = useMemo(() => parseRecent(recentRaw).filter((r) => courses.some((c) => c.course_id === r.courseId)), [recentRaw, courses]);

  // The course's rows follow the pick (a timer, not a synchronous set in
  // the effect — the React compiler's rule). A failure — the server's
  // refusal or a dropped connection — waits for Try again.
  useEffect(() => {
    if (!courseId || courseId === loadedCourse) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        let result: Awaited<ReturnType<typeof loadQuizBuilderCourse>>;
        try {
          result = await (pack ? loadPackBuilderCourse : loadQuizBuilderCourse)(courseId);
        } catch {
          result = { ok: false, error: NO_CONNECTION_LOAD };
        }
        if (cancelled) return;
        setItems(result.ok ? result.items : []);
        setLoadedCourse(courseId);
        setLoadFailed(result.ok ? '' : result.error);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [courseId, loadedCourse, pack]);

  function retryLoad() {
    setLoadFailed('');
    setLoadedCourse('');
  }

  // The keyword's ids, a moment after the typing stops; a reply for an
  // older word or course is dropped; a failure waits for Try again.
  const typed = word.trim();
  useEffect(() => {
    if (way !== 'keyword' || !typed || !courseId || loadedCourse !== courseId) return;
    if (kw && kw.courseId === courseId && kw.word === typed) return;
    if (kwFailed && kwFailed.courseId === courseId && kwFailed.word === typed) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        let result: Awaited<ReturnType<typeof searchQuizBuilderKeyword>>;
        try {
          result = await (pack ? searchPackBuilderKeyword : searchQuizBuilderKeyword)(courseId, typed);
        } catch {
          result = { ok: false, error: NO_CONNECTION_SEARCH };
        }
        if (cancelled) return;
        if (!result.ok) {
          setKwFailed({ courseId, word: typed, message: result.error });
          return;
        }
        setKw({ courseId, word: typed, ids: new Set(result.itemIds) });
      })();
    }, CONCEPT_SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [way, typed, courseId, loadedCourse, kw, kwFailed, pack]);

  // ── the pools and every count, from the rows already here ──
  const loading = Boolean(courseId) && loadedCourse !== courseId;
  const loaded = Boolean(courseId) && loadedCourse === courseId && !loadFailed;
  const pool = loaded ? items : [];
  const topicCounts = countBy(pool, topicOf);
  const kwReady = way === 'keyword' && Boolean(typed) && kw !== null && kw.courseId === courseId && kw.word === typed;
  const kwError = way === 'keyword' && typed && kwFailed && kwFailed.courseId === courseId && kwFailed.word === typed ? kwFailed.message : '';
  const searching = way === 'keyword' && Boolean(typed) && loaded && !kwReady && !kwError;
  const kwPool = kwReady ? pool.filter((i) => kw.ids.has(i.item_id)) : [];
  const kwTopicCounts = countBy(kwPool, topicOf);

  // A choice the course does not have is dropped, as the old wizard did on
  // a course change — a tick never stays on with no box to untick it.
  const pickedTopics = topics.filter((t) => topicCounts.has(t));
  const pickedKw = kwTopics.filter((t) => kwTopicCounts.has(t));
  const diffNames = [...new Set(pool.map((i) => i.difficulty || NOT_SET))].sort(
    (a, b) => (DIFF_ORDER.indexOf(a) + 1 || 99) - (DIFF_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  );
  const typeNames = [...new Set(pool.map((i) => i.question_type))].sort();
  const pickedDiffs = diffs.filter((d) => diffNames.includes(d));
  const pickedTypes = types.filter((t) => typeNames.includes(t));

  const whatPool =
    way === 'topics'
      ? !useAllTopics && pickedTopics.length
        ? pool.filter((i) => pickedTopics.includes(topicOf(i)))
        : pool
      : pickedKw.length
        ? kwPool.filter((i) => pickedKw.includes(topicOf(i)))
        : kwPool;

  const passWhich = (i: QuizBuilderItem, w: Which) => w === 'all' || (w === 'new' ? !i.seen : i.wrong);
  const passDiff = (i: QuizBuilderItem) => !pickedDiffs.length || pickedDiffs.includes(i.difficulty || NOT_SET);
  const passType = (i: QuizBuilderItem) => !pickedTypes.length || pickedTypes.includes(i.question_type);
  const finalPool = whatPool.filter((i) => passWhich(i, which) && passDiff(i) && passType(i));

  // Each filter's boxes count with the other filters applied.
  const whichCounts = new Map(WHICH.map((w) => [w.id, whatPool.filter((i) => passWhich(i, w.id) && passDiff(i) && passType(i)).length]));
  const diffCounts = new Map(diffNames.map((d) => [d, whatPool.filter((i) => passWhich(i, which) && (i.difficulty || NOT_SET) === d && passType(i)).length]));
  const typeCounts = new Map(typeNames.map((t) => [t, whatPool.filter((i) => passWhich(i, which) && passDiff(i) && i.question_type === t).length]));

  // ── count, mode ──
  const matching = finalPool.length;
  const cap = Math.min(maxQuestions, matching);
  const enough = matching >= MIN;
  const n = enough ? Math.max(MIN, Math.min(count, cap)) : 0;
  const modeNow: AttemptMode = free && modeOf(mode).group === 'exam' ? 'UNTIMED_LEARNING' : mode;
  const modeDef = modeOf(modeNow);
  const minutes = Math.ceil(n * minutesPerQuestion);

  // ── the status box (legacy renderSummary's) ──
  let reason = '';
  if (!course) reason = 'Choose a course to begin.';
  else if (loadFailed) reason = loadFailed;
  else if (!loaded) reason = 'Loading the questions…';
  else if (!pool.length) reason = free ? 'No free questions in this course yet.' : 'No questions in this course yet.';
  else if (way === 'topics' && !useAllTopics && !pickedTopics.length) reason = 'Select at least one topic or use all topics.';
  else if (way === 'keyword' && !typed) reason = 'Type a word to find questions.';
  else if (kwError) reason = kwError;
  else if (searching) reason = 'Searching…';
  else if (matching === 0) reason = way === 'keyword' && !kwPool.length ? `No question contains “${typed}”.` : 'No questions match your filters. Untick a filter.';
  else if (!enough) reason = `Only ${matching} ${matching === 1 ? 'question matches' : 'questions match'}. A ${pack ? 'pack' : 'quiz'} needs at least ${MIN} — untick a filter${way === 'keyword' ? ' or try another word' : ''}.`;
  else if (pack && course.packsLeft === 0) reason = 'You have used all your offline packs for this course.';
  const ready = !reason;
  const status = building
    ? pack
      ? 'Making your pack…'
      : 'Building your quiz…'
    : reason || `Ready — ${questions(n)} from a pool of ${matching.toLocaleString('en-GB')}.`;

  // The quiz's name in Learning History — what was chosen; "All topics" never names three.
  const selection =
    way === 'topics'
      ? useAllTopics || !pickedTopics.length
        ? 'All topics'
        : shortList(pickedTopics)
      : `“${typed}”${pickedKw.length ? ` in ${shortList(pickedKw)}` : ''}`;
  const quizName = `${course?.title ?? ''} · ${selection} · ${questions(n)}`;
  // 07.2: a pack's suggested name — what was chosen and how many
  const packSuggestion = `${selection} · ${questions(n)}`;
  const packNameNow = packName.trim() || packSuggestion;
  const packsLeftAfter =
    course && course.packsLeft !== undefined && course.packsLeft !== null ? Math.max(0, course.packsLeft - 1) : null;

  const trialNote =
    course?.reason === 'trial' && course.quizzesLeft
      ? course.quizzesLeft === 1
        ? 'Uses your last trial quiz.'
        : `Uses one of your ${course.quizzesLeft} trial quizzes left.`
      : '';

  function goStep(i: number) {
    setStep(Math.max(0, Math.min(4, i)));
    setExamNote(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pickCourse(id: string) {
    if (id === courseId) return;
    setCourseId(id);
    setTopics([]);
    setKwTopics([]);
    setTopicFind('');
    setExamNote(false);
  }

  function applyRecent(r: RecentSetup) {
    setCourseId(r.courseId);
    setWay(r.way === 'keyword' ? 'keyword' : 'topics');
    setUseAllTopics(Boolean(r.useAllTopics));
    setTopics(list(r.topics));
    setWord(String(r.word || ''));
    setKwTopics(list(r.kwTopics));
    setWhich(r.which === 'new' || r.which === 'wrong' ? r.which : 'all');
    setDiffs(list(r.diffs));
    setTypes(list(r.types));
    setCount(Number(r.count) || COUNT_DEFAULT);
    setCountText(null);
    setMode(MODE_ORDER.includes(r.mode) ? r.mode : 'UNTIMED_LEARNING');
    setTopicFind('');
    // legacy: the course loads, then the wizard lands on the last step
    goStep(4);
  }

  async function build() {
    if (!ready || building || !course) return;
    if (pack) {
      await makePack();
      return;
    }
    setBuilding(true);
    const chosen = shuffle(finalPool)
      .slice(0, n)
      .map((i) => i.item_id);
    let result: Awaited<ReturnType<typeof startQuizBuilderQuiz>>;
    try {
      result = await startQuizBuilderQuiz(course.course_id, chosen, modeNow, quizName);
    } catch {
      result = { ok: false, error: NO_CONNECTION_BUILD };
    }
    if (!result.ok) {
      setToast(result.error);
      setBuilding(false);
      return;
    }
    saveRecent(recentBase, userKey, {
      courseId: course.course_id,
      way,
      useAllTopics,
      topics: pickedTopics,
      word: typed,
      kwTopics: pickedKw,
      which,
      diffs: pickedDiffs,
      types: pickedTypes,
      count: n,
      mode: modeNow,
      savedAt: nowMs(),
    });
    router.push(sessionHref(result.attemptId));
  }

  // 07.2: Make pack — the pool as worked out here, how many and the name;
  // the server puts questions not in earlier packs first, then makes it.
  async function makePack() {
    if (!course) return;
    setBuilding(true);
    let result: Awaited<ReturnType<typeof makeOfflinePack>>;
    try {
      result = await makeOfflinePack({
        course_id: course.course_id,
        pool_ids: finalPool.map((i) => i.item_id),
        n,
        pack_name: packNameNow.slice(0, 120),
        selection_mode: way === 'keyword' ? 'concept' : 'topics',
        maintopics: way === 'topics' ? (useAllTopics ? [] : pickedTopics) : pickedKw,
        difficulties: pickedDiffs,
        question_types: pickedTypes,
        concept_query: way === 'keyword' ? typed : '',
      });
    } catch {
      result = { ok: false, reason: 'create_failed', message: NO_CONNECTION_MAKE, allowance: null };
    }
    if (!result.ok) {
      setToast(result.message);
      setBuilding(false);
      return;
    }
    saveRecent(recentBase, userKey, {
      courseId: course.course_id,
      way,
      useAllTopics,
      topics: pickedTopics,
      word: typed,
      kwTopics: pickedKw,
      which,
      diffs: pickedDiffs,
      types: pickedTypes,
      count: n,
      mode: modeNow,
      savedAt: nowMs(),
    });
    // the pack's own page (07.8); ?new=1 keeps it on the phone it was made on (07.3)
    router.push(`/student/offline-packs/${encodeURIComponent(result.pack_id)}?new=1`);
  }

  // ── the topic lists ──
  const find = topicFind.trim().toLowerCase();
  const allTopicNames = [...topicCounts.keys()].sort(byName);
  const shownTopics = find ? allTopicNames.filter((t) => t.toLowerCase().includes(find)) : allTopicNames;
  // the keyword's topics: where most of the matches sit first
  const kwList = [...kwTopicCounts].sort((a, b) => b[1] - a[1] || byName(a[0], b[0]));

  const whatSummary =
    way === 'topics'
      ? useAllTopics
        ? 'All topics'
        : pickedTopics.length
          ? pickedTopics.join(', ')
          : '—'
      : typed
        ? `“${typed}”${pickedKw.length ? ` in ${pickedKw.join(', ')}` : ''}`
        : '—';

  const loadProblem = loadFailed ? (
    <div className="status-box is-warn" role="alert">
      {loadFailed}{' '}
      <button type="button" className="btn btn-link" onClick={retryLoad}>
        Try again
      </button>
    </div>
  ) : null;

  return (
    <div className="qbld">
      {pack ? course ? <PackBanner course={course} /> : null : bannerCourse ? <Banner course={bannerCourse} /> : null}

      {/* Progress bar */}
      <div className="card prog-block">
        <div className="prog-bar">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={i < 4 ? 'prog-step' : 'prog-step last'}>
              <button
                type="button"
                className={`prog-circle${i < step ? ' done' : i === step ? ' active' : ''}`}
                aria-label={`Step ${i + 1}: ${names.long[i]}`}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => goStep(i)}
              >
                {i < step ? '✓' : String(i + 1)}
              </button>
              {i < 4 ? <div className={`prog-line${i < step ? ' done' : ''}`} /> : null}
            </div>
          ))}
        </div>
        <div className="prog-labels" aria-hidden="true">
          {names.short.map((label, i) => (
            <div key={i} className={`prog-lbl${i < step ? ' done' : i === step ? ' active' : ''}`} onClick={() => goStep(i)}>
              {label}
            </div>
          ))}
        </div>
        <div className="prog-step-label">
          <strong>
            Step {step + 1} of 5 — {names.long[step]}
          </strong>
        </div>
      </div>

      {loadProblem}

      {/* PANE 0 — course & selection mode */}
      {step === 0 ? (
        <div className="card pane-card">
          <h2 className="pane-title">Course &amp; selection mode</h2>
          <p className="pane-sub">Choose a course, then decide how you want to select questions.</p>

          {recent.length ? (
            <div className="recent-collapse">
              <button type="button" className="recent-toggle" aria-expanded={recentOpen} onClick={() => setRecentOpen((v) => !v)}>
                <span className="recent-toggle-lbl">
                  Recent setups <span className="recent-count">— {recent.length} saved</span>
                </span>
                <span className={`recent-toggle-caret${recentOpen ? ' open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              {recentOpen ? (
                <div className="recent-body">
                  {recent.map((r) => {
                    const when = r.savedAt
                      ? new Date(r.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Saved';
                    const what = r.way === 'keyword' ? `Keyword “${r.word}”` : r.useAllTopics || !list(r.topics).length ? 'All topics' : shortList(list(r.topics));
                    const how = pack ? '' : ` · ${modeOf(r.mode).name}`;
                    return (
                      <div key={`${r.courseId}:${r.way}`} className="recent-item">
                        <div className="recent-main">
                          <div className="recent-title">{courses.find((c) => c.course_id === r.courseId)?.title}</div>
                          <div className="recent-sub">
                            {what} · {r.count}Q{how} · {when}
                          </div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm qbld-small-btn" onClick={() => applyRecent(r)}>
                          Use this
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="field-grid">
            <div className="field">
              <label htmlFor="courseSelect">Course</label>
              <select id="courseSelect" value={courseId} onChange={(e) => pickCourse(e.target.value)}>
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id} disabled={(c.total === 0 || (pack && c.packsLeft === 0)) && c.course_id !== courseId}>
                    {c.title}
                    {c.pool === 'free' ? (c.total ? ` — ${c.total.toLocaleString('en-GB')} free questions` : ' — no free questions yet') : ''}
                    {pack && c.packsLeft === 0 ? ' — no packs left' : ''}
                  </option>
                ))}
              </select>
              <span className="hint">
                {pack
                  ? 'Your courses whose package includes offline packs.'
                  : courses.some((c) => c.pool === 'free')
                    ? 'A course marked “free” builds from its free questions.'
                    : 'Only your active courses are shown.'}
              </span>
            </div>
            <div className="field">
              <span className="field-label" id="qbld-way">
                Selection mode
              </span>
              <div className="segmented" role="group" aria-labelledby="qbld-way">
                <button type="button" className={way === 'topics' ? 'picked' : ''} aria-pressed={way === 'topics'} onClick={() => setWay('topics')}>
                  Topics
                </button>
                <button type="button" className={way === 'keyword' ? 'picked' : ''} aria-pressed={way === 'keyword'} onClick={() => setWay('keyword')}>
                  Keyword
                </button>
              </div>
              <span className="hint">{way === 'keyword' ? 'Keyword = find every question containing a word.' : 'Topics = choose from main topic groups.'}</span>
            </div>
          </div>
          <div className="nav-bar">
            <span />
            <button type="button" className="btn btn-primary btn-lg" onClick={() => goStep(1)}>
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* PANE 1 — topics / keyword */}
      {step === 1 ? (
        <div className="card pane-card">
          <h2 className="pane-title">{way === 'keyword' ? 'Keyword search' : 'Topics'}</h2>
          <p className="pane-sub">{way === 'keyword' ? 'Type a word to find every question containing it.' : 'Select one or more topics to draw questions from.'}</p>

          {way === 'topics' ? (
            <div>
              <div className="use-all-row">
                <input type="checkbox" id="useAllTopics" checked={useAllTopics} onChange={(e) => setUseAllTopics(e.target.checked)} />
                <label htmlFor="useAllTopics">Use all topics for this course</label>
              </div>
              <div className="topics-toolbar">
                <input type="text" aria-label="Filter topics" placeholder="Filter topics…" value={topicFind} onChange={(e) => setTopicFind(e.target.value)} />
                <button type="button" className="btn btn-ghost btn-sm qbld-small-btn" onClick={() => setTopics((s) => list([...s, ...shownTopics]))}>
                  Select all shown
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm qbld-small-btn"
                  onClick={() => {
                    setTopics([]);
                    setUseAllTopics(false);
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="topics-box" role="group" aria-label="Topics">
                {!courseId ? (
                  <div className="topics-empty">Choose a course first.</div>
                ) : loading ? (
                  <div className="topics-empty">Loading…</div>
                ) : !shownTopics.length ? (
                  <div className="topics-empty">{find ? `No topic has “${topicFind.trim()}” in its name.` : 'No topics found.'}</div>
                ) : (
                  shownTopics.map((t) => (
                    <TopicTile
                      key={t}
                      label={t}
                      count={topicCounts.get(t) ?? 0}
                      picked={useAllTopics || pickedTopics.includes(t)}
                      onClick={() => {
                        if (!useAllTopics) setTopics((s) => toggleIn(s, t));
                      }}
                    />
                  ))
                )}
              </div>
              {useAllTopics ? (
                <div className="chips-row">
                  <span className="picked-chip">All topics</span>
                </div>
              ) : (
                <PickedChips names={pickedTopics} onRemove={(t) => setTopics((s) => s.filter((x) => x !== t))} />
              )}
            </div>
          ) : (
            <div>
              <div className="concept-search-row">
                <input type="text" aria-label="Keyword" placeholder="e.g. malaria, jaundice, shock…" value={word} onChange={(e) => setWord(e.target.value)} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm qbld-small-btn"
                  onClick={() => {
                    setWord('');
                    setKwTopics([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <span className="hint block">Finds every question with a word starting this way — in the question, its explanation or its topic.</span>
              {typed ? (
                <p className={kwError || (kwReady && !kwPool.length) ? 'kw-line is-none' : 'kw-line'} aria-live="polite">
                  {!courseId ? (
                    'Choose a course first.'
                  ) : kwError ? (
                    <>
                      {kwError}{' '}
                      <button type="button" className="btn btn-link" onClick={() => setKwFailed(null)}>
                        Try again
                      </button>
                    </>
                  ) : searching || loading ? (
                    'Searching…'
                  ) : kwPool.length ? (
                    `${questions(kwPool.length)} contain “${typed}”`
                  ) : (
                    `No question contains “${typed}” — try the start of the word: “malar” finds malaria and malarial.`
                  )}
                </p>
              ) : null}
              {kwPool.length ? (
                <>
                  <span className="hint block">They are in the topics below. Tick some to narrow it down, or leave none ticked for all of them.</span>
                  <div className="topics-box" role="group" aria-label={`Topics with ${typed}`}>
                    {kwList.map(([t, c]) => (
                      <TopicTile key={t} label={t} count={c} picked={pickedKw.includes(t)} onClick={() => setKwTopics((s) => toggleIn(s, t))} />
                    ))}
                  </div>
                  <PickedChips names={pickedKw} onRemove={(t) => setKwTopics((s) => s.filter((x) => x !== t))} />
                </>
              ) : null}
            </div>
          )}
          <div className="nav-bar">
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => goStep(0)}>
              ← Back
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => goStep(2)}>
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* PANE 2 — filters */}
      {step === 2 ? (
        <div className="card pane-card">
          <h2 className="pane-title">Filters</h2>
          <p className="pane-sub">Narrow your pool by what you have answered, difficulty and question format. Leave a row blank to include all.</p>
          {!courseId ? (
            <p className="hint">Choose a course first.</p>
          ) : loading ? (
            <p className="hint">Loading the questions…</p>
          ) : (
            <>
              <fieldset className="field">
                <legend>Which questions</legend>
                <div className="checks-grid">
                  {WHICH.map((w) => (
                    <label key={w.id} className={which === w.id ? 'check-item picked' : 'check-item'}>
                      <input type="radio" name="qbld-which" checked={which === w.id} onChange={() => setWhich(w.id)} />
                      <span className="check-item-name">{w.label}</span>
                      <span className="check-item-count">{(whichCounts.get(w.id) ?? 0).toLocaleString('en-GB')}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field-grid">
                <fieldset className="field">
                  <legend>Difficulty</legend>
                  <div className="checks-grid">
                    {diffNames.map((d) => {
                      const picked = pickedDiffs.includes(d);
                      return (
                        <label key={d} className={picked ? 'check-item picked' : 'check-item'}>
                          <input type="checkbox" checked={picked} onChange={() => setDiffs((s) => toggleIn(s, d))} />
                          <span className="check-item-name">{d}</span>
                          <span className="check-item-count">{(diffCounts.get(d) ?? 0).toLocaleString('en-GB')}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="field">
                  <legend>Question type</legend>
                  <div className="checks-grid">
                    {typeNames.map((t) => {
                      const picked = pickedTypes.includes(t);
                      return (
                        <label key={t} className={picked ? 'check-item picked' : 'check-item'}>
                          <input type="checkbox" checked={picked} onChange={() => setTypes((s) => toggleIn(s, t))} />
                          <span className="check-item-name">{typeLabel(t)}</span>
                          <span className="check-item-count">{(typeCounts.get(t) ?? 0).toLocaleString('en-GB')}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </>
          )}
          <div className="pool-bar">
            <span className="pool-bar-lbl">Questions matching your filters</span>
            <span className="pool-bar-count">{loaded && !searching ? `${matching.toLocaleString('en-GB')} available` : '…'}</span>
          </div>
          <div className="nav-bar">
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => goStep(1)}>
              ← Back
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => goStep(3)}>
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* PANE 3 — count & mode */}
      {step === 3 ? (
        <div className="card pane-card">
          <h2 className="pane-title">{pack ? 'Count & name' : 'Count & mode'}</h2>
          <p className="pane-sub">{pack ? 'How many questions, and what to call the pack?' : 'How many questions, and how do you want to take the quiz?'}</p>
          <div className="count-display-row">
            <div>
              <div className="count-big">{enough ? n : '—'}</div>
              <div className="count-sub">questions</div>
            </div>
            <div className="count-controls">
              <input
                type="range"
                aria-label="Number of questions"
                min={MIN}
                max={Math.max(MIN, cap)}
                step={1}
                value={enough ? n : MIN}
                disabled={!enough}
                onChange={(e) => {
                  setCount(Number(e.target.value));
                  setCountText(null);
                }}
              />
              <div className="count-input-row">
                <input
                  type="number"
                  aria-label="Number of questions"
                  min={MIN}
                  max={Math.max(MIN, cap)}
                  placeholder="Enter number"
                  disabled={!enough}
                  value={countText ?? (enough ? String(n) : '')}
                  onChange={(e) => {
                    setCountText(e.target.value);
                    const v = Math.floor(Number(e.target.value));
                    if (v > 0) setCount(v);
                  }}
                  onBlur={() => setCountText(null)}
                />
                <span className="hint">or use the slider</span>
              </div>
            </div>
          </div>
          <div className="count-hint">
            {enough
              ? `From ${MIN} to ${cap} questions · Pool: ${matching.toLocaleString('en-GB')} available${pack ? '' : ` · Estimated ${minutes} min`}`
              : `A ${pack ? 'pack' : 'quiz'} needs at least ${MIN} questions · Pool: ${loaded ? matching.toLocaleString('en-GB') : '…'} available`}
          </div>
          {pack ? (
            <div className="field">
              <label htmlFor="packName">Pack name</label>
              <input id="packName" type="text" maxLength={120} placeholder={packSuggestion} value={packName} onChange={(e) => setPackName(e.target.value)} />
              <span className="hint">Leave it empty to use “{packSuggestion}”.</span>
            </div>
          ) : (
          <>
          <span className="mode-label">Mode</span>
          <div className="mode-grid">
            {MODE_GROUPS.map((g) => (
              <div key={g.group} className="mode-group">
                <div className="mode-group-label">{g.label}</div>
                {MODE_ORDER.filter((code) => MODES[code].group === g.group).map((code) => {
                  const locked = free && g.group === 'exam';
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`mode-card${modeNow === code ? ' picked' : ''}${locked ? ' locked' : ''}`}
                      aria-pressed={modeNow === code}
                      aria-describedby={locked ? 'qbld-exam-locked' : undefined}
                      onClick={() => {
                        if (locked) {
                          setExamNote(true);
                          return;
                        }
                        setMode(code);
                        setExamNote(false);
                      }}
                    >
                      <span className="mode-card-title">
                        {MODES[code].name}
                        {locked ? <Icon name="lock" className="mode-card-lock" /> : null}
                      </span>
                      <span className="mode-card-desc">{MODES[code].card}</span>
                      <span className={`mode-badge ${MODE_BADGE[code]}`}>{MODES[code].fullName}</span>
                    </button>
                  );
                })}
                {free && g.group === 'exam' ? (
                  <p id="qbld-exam-locked" className={examNote ? 'exam-note is-shown' : 'exam-note'}>
                    The exam modes open with a package.{' '}
                    <AppLink href={PACKAGES_HREF} className="exam-note-link">
                      Choose a package
                    </AppLink>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mode-hint">{modeDef.clock !== 'none' ? `${modeDef.fullName} will give you ${minutesText(minutes)}.` : `${modeDef.fullName} has no clock.`}</div>
          </>
          )}
          <div className="nav-bar">
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => goStep(2)}>
              ← Back
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => goStep(4)}>
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* PANE 4 — review & build */}
      {step === 4 ? (
        <div className="card pane-card">
          <h2 className="pane-title">{pack ? 'Review & make' : 'Review & build'}</h2>
          <p className="pane-sub">{pack ? 'Check your setup, then make the pack.' : 'Check your setup, then build the quiz.'}</p>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-num">{loaded && !searching ? matching.toLocaleString('en-GB') : '…'}</div>
              <div className="stat-lbl">Pool size</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{enough ? n : '—'}</div>
              <div className="stat-lbl">Questions selected</div>
            </div>
            {pack ? (
              <div className="stat-card">
                <div className="stat-num">{packsLeftAfter === null ? 'No limit' : packsLeftAfter}</div>
                <div className="stat-lbl">Packs left after this</div>
              </div>
            ) : (
              <div className="stat-card">
                <div className="stat-num">{enough ? `${minutes} min` : '—'}</div>
                <div className="stat-lbl">Estimated time</div>
              </div>
            )}
          </div>
          <div className="summary-grid">
            {(
              [
                ['Course', course ? course.title + (free ? ' · free questions' : '') : '—', 0],
                [way === 'keyword' ? 'Keyword' : 'Topics', whatSummary, 1],
                ['Questions', WHICH.find((w) => w.id === which)!.label, 2],
                ['Difficulty', pickedDiffs.length ? pickedDiffs.join(', ') : 'All', 2],
                ['Question type', pickedTypes.length ? pickedTypes.map(typeLabel).join(', ') : 'All types', 2],
                pack ? ['Name', packNameNow, 3] : ['Mode', modeDef.fullName, 3],
              ] as [string, string, number][]
            ).map(([label, value, target]) => (
              <div key={label} className="summary-item">
                <div className="summary-head">
                  <div className="summary-label">{label}</div>
                  <button type="button" className="btn btn-link review-edit" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => goStep(target)}>
                    Edit
                  </button>
                </div>
                <div className="summary-value">{value}</div>
              </div>
            ))}
          </div>
          <div className={ready || building ? 'status-box' : 'status-box is-warn'} aria-live="polite">
            {status}
          </div>
          {trialNote ? <p className="trial-note">{trialNote}</p> : null}
          <div className="nav-bar">
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => goStep(3)}>
              ← Back
            </button>
            <button type="button" className="btn btn-accent btn-lg" disabled={!ready || building} onClick={() => void build()}>
              {building ? (pack ? 'Making…' : 'Building…') : pack ? 'Make pack →' : 'Build quiz →'}
            </button>
          </div>
        </div>
      ) : null}

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}
