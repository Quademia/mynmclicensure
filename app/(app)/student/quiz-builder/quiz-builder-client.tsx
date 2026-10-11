// app/(app)/student/quiz-builder/quiz-builder-client.tsx — the Quiz
// Builder (04.4; Sam, 2026-10-11, layout C of his canvas, with Filters a
// section of its own and By topic | By keyword kept apart).
//
// One page, sections folded to a line saying what is chosen: Course ·
// What to practise · Filters · Mode, then How many; the count of matching
// questions and Start pinned (above the phone's bottom bar; on a computer
// a card on the right, every section open). No Next taps.
//
// The course's light rows load once on pick (a Server Action, through the
// builder's door — the whole bank or the free questions), each marked
// seen / got wrong from the student's own answers; every count after that
// is worked out here, so a tap costs no request on a weak connection. The
// keyword alone goes to the server (the question text never reaches the
// page), a moment after the typing stops. Start shuffles the pool, takes
// the first N and asks the server, which checks it all again; the
// database's own refusal shows in its words.
//
// "Repeat last" is remembered on this device only (Sam, 2026-10-11), and
// only for the student who built it — a shared phone does not hand one
// student's last quiz to the next (found walking student4 after +7).

'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { loadQuizBuilderCourse, searchQuizBuilderKeyword, startQuizBuilderQuiz } from '@/lib/attempts/actions';
import { sessionHref } from '@/lib/attempts/links';
import { MODES, MODE_ORDER, modeOf } from '@/lib/attempts/modes';
import { BUILDER_MIN_QUESTIONS, CONCEPT_SEARCH_DELAY_MS, type AttemptMode, type BuilderDoorCourse, type QuizBuilderItem } from '@/lib/attempts/types';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { Toast } from '@/lib/toast/toast';
import { ArrowRight, Banner, Chip, ModeCard, TopicTile } from './builder-parts';

type Way = 'topic' | 'keyword';
type Which = 'all' | 'new' | 'wrong';
// The four steps (Sam, 2026-10-11: four steps, Start from any step, the
// old wizard's ticks at the top). short: the phone's name under its circle.
const STEPS = [
  { id: 'course', name: 'Course', short: 'Course' },
  { id: 'what', name: 'What to practise', short: 'Practise' },
  { id: 'filters', name: 'Filters', short: 'Filters' },
  { id: 'how', name: 'How to take it', short: 'How' },
] as const;

const MIN = BUILDER_MIN_QUESTIONS;
const COUNT_STEP = 5;
const COUNT_DEFAULT = 20;
const COUNT_PICKS = [10, 20, 30, 50];
/** Above this many topics, a Find a topic box sits over the list. */
const TOPICS_SHOWN = 8;
const NOT_SET = 'Not set';
const PACKAGES_HREF = '/student/upgrade';

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

// ── "Repeat last", on this device (browser storage through
// useSyncExternalStore — AGENTS.md: never read in render or set from an
// effect) ──
type LastSetup = {
  courseId: string;
  way: Way;
  topics: string[];
  word: string;
  kwTopics: string[];
  which: Which;
  diffs: string[];
  types: string[];
  mode: AttemptMode;
  count: number;
};

const LAST_KEY = 'qa_builder_last_v2';
const lastKeyOf = (userKey: string) => `${LAST_KEY}:${userKey}`;
const lastListeners = new Set<() => void>();

function subscribeLast(onChange: () => void): () => void {
  lastListeners.add(onChange);
  return () => {
    lastListeners.delete(onChange);
  };
}
function readLast(userKey: string): string {
  try {
    return window.localStorage.getItem(lastKeyOf(userKey)) || '';
  } catch {
    return '';
  }
}
function lastOnServer(): string {
  return '';
}
function saveLast(userKey: string, setup: LastSetup): void {
  try {
    window.localStorage.setItem(lastKeyOf(userKey), JSON.stringify(setup));
  } catch {
    /* storage blocked — Repeat last simply does not show */
  }
  for (const onChange of lastListeners) onChange();
}
function parseLast(raw: string): LastSetup | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LastSetup;
    return v && typeof v.courseId === 'string' ? v : null;
  } catch {
    return null;
  }
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
/** Biggest first, then by name — the canvas's order. */
function ranked(counts: Map<string, number>): [string, number][] {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function toggleIn(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
function shortList(names: string[]): string {
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}
function questions(n: number): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? 'question' : 'questions'}`;
}
// Fisher–Yates; called from Start's handler, never in render.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The summary — each row's choice and a Change that goes to its step (the old Review's Edit). */
function Recap({ rows, onChange, className }: { rows: [string, string, number][]; onChange: (step: number) => void; className?: string }) {
  return (
    <dl className={className ? `qb-recap ${className}` : 'qb-recap'}>
      {rows.map(([label, value, to]) => (
        <div key={label} className="qb-recap-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
          <button type="button" className="btn btn-link qb-recap-change" aria-label={`Change ${label.toLowerCase()}`} onClick={() => onChange(to)}>
            Change
          </button>
        </div>
      ))}
    </dl>
  );
}

export function QuizBuilderClient({
  courses,
  maxQuestions,
  minutesPerQuestion,
  initialCourseId,
  initialTopic,
  userKey,
}: {
  courses: BuilderDoorCourse[];
  maxQuestions: number;
  minutesPerQuestion: number;
  initialCourseId: string;
  /** The report's and the dashboard's "Practise this topic". */
  initialTopic: string;
  /** The student's own id — Repeat last is kept per student on a device. */
  userKey: string;
}) {
  const router = useRouter();

  // ── what the student chose ──
  const [courseId, setCourseId] = useState(
    () => initialCourseId || courses.find((c) => c.total >= MIN)?.course_id || courses[0].course_id,
  );
  const [way, setWay] = useState<Way>('topic');
  const [topics, setTopics] = useState<string[]>(() => (initialTopic ? [initialTopic] : []));
  const [topicFind, setTopicFind] = useState('');
  const [word, setWord] = useState('');
  const [kwTopics, setKwTopics] = useState<string[]>([]);
  const [which, setWhich] = useState<Which>('all');
  const [diffs, setDiffs] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [mode, setMode] = useState<AttemptMode>('UNTIMED_LEARNING');
  const [count, setCount] = useState(COUNT_DEFAULT);
  // A course from the address (the course page, the report) skips step 1.
  const [step, setStep] = useState(() => (initialCourseId ? 1 : 0));
  const [examNote, setExamNote] = useState(false);

  // ── the course's rows, the keyword's ids, Start ──
  const [items, setItems] = useState<QuizBuilderItem[]>([]);
  const [loadedCourse, setLoadedCourse] = useState('');
  const [loadFailed, setLoadFailed] = useState('');
  const [kw, setKw] = useState<{ courseId: string; word: string; ids: Set<string> } | null>(null);
  const [building, setBuilding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const course = courses.find((c) => c.course_id === courseId) ?? courses[0];
  const free = course.pool === 'free';
  const lastRaw = useSyncExternalStore(subscribeLast, () => readLast(userKey), lastOnServer);
  const last = useMemo(() => parseLast(lastRaw), [lastRaw]);
  const lastCourse = last ? courses.find((c) => c.course_id === last.courseId) : undefined;

  // The course's rows follow the pick (a timer, not a synchronous set in
  // the effect — the React compiler's rule). A failed load waits for Try
  // again rather than asking again on its own.
  useEffect(() => {
    if (courseId === loadedCourse) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        const result = await loadQuizBuilderCourse(courseId);
        if (cancelled) return;
        if (!result.ok) {
          setItems([]);
          setLoadedCourse(courseId);
          setLoadFailed(result.error);
          return;
        }
        setItems(result.items);
        setLoadedCourse(courseId);
        setLoadFailed('');
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [courseId, loadedCourse]);

  function retryLoad() {
    setLoadFailed('');
    setLoadedCourse('');
  }

  // The keyword's ids, a moment after the typing stops; a reply for an
  // older word or course is dropped.
  const typed = word.trim();
  useEffect(() => {
    if (way !== 'keyword' || !typed || loadedCourse !== courseId) return;
    if (kw && kw.courseId === courseId && kw.word === typed) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        const result = await searchQuizBuilderKeyword(courseId, typed);
        if (cancelled) return;
        if (!result.ok) {
          setToast(result.error);
          return;
        }
        setKw({ courseId, word: typed, ids: new Set(result.itemIds) });
      })();
    }, CONCEPT_SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [way, typed, courseId, loadedCourse, kw]);

  // ── the pools and every count, from the rows already here ──
  const loaded = loadedCourse === courseId && !loadFailed;
  const pool = loaded ? items : [];
  const topicCounts = countBy(pool, topicOf);
  const kwReady = way === 'keyword' && Boolean(typed) && kw !== null && kw.courseId === courseId && kw.word === typed;
  const searching = way === 'keyword' && Boolean(typed) && loaded && !kwReady;
  const kwPool = kwReady ? pool.filter((i) => kw.ids.has(i.item_id)) : [];
  const kwTopicCounts = countBy(kwPool, topicOf);

  const pickedTopics = topics.filter((t) => topicCounts.has(t));
  const pickedKw = kwTopics.filter((t) => kwTopicCounts.has(t));
  const whatPool =
    way === 'topic'
      ? pickedTopics.length
        ? pool.filter((i) => pickedTopics.includes(topicOf(i)))
        : pool
      : pickedKw.length
        ? kwPool.filter((i) => pickedKw.includes(topicOf(i)))
        : kwPool;

  const passWhich = (i: QuizBuilderItem, w: Which) => w === 'all' || (w === 'new' ? !i.seen : i.wrong);
  const passDiff = (i: QuizBuilderItem) => !diffs.length || diffs.includes(i.difficulty || NOT_SET);
  const passType = (i: QuizBuilderItem) => !types.length || types.includes(i.question_type);
  const finalPool = whatPool.filter((i) => passWhich(i, which) && passDiff(i) && passType(i));

  // Each filter's chips count with the other filters applied.
  const whichCounts = new Map(WHICH.map((w) => [w.id, whatPool.filter((i) => passWhich(i, w.id) && passDiff(i) && passType(i)).length]));
  const diffNames = [...new Set(pool.map((i) => i.difficulty || NOT_SET))].sort(
    (a, b) => (DIFF_ORDER.indexOf(a) + 1 || 99) - (DIFF_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  );
  const typeNames = [...new Set(pool.map((i) => i.question_type))].sort();
  const diffCounts = new Map(diffNames.map((d) => [d, whatPool.filter((i) => passWhich(i, which) && (i.difficulty || NOT_SET) === d && passType(i)).length]));
  const typeCounts = new Map(typeNames.map((t) => [t, whatPool.filter((i) => passWhich(i, which) && passDiff(i) && i.question_type === t).length]));

  // ── how many, the mode, Start ──
  const matching = finalPool.length;
  const cap = Math.min(maxQuestions, matching);
  const enough = matching >= MIN;
  const n = enough ? Math.max(MIN, Math.min(count, cap)) : 0;
  const modeNow: AttemptMode = free && modeOf(mode).group === 'exam' ? 'UNTIMED_LEARNING' : mode;
  const modeDef = modeOf(modeNow);
  const exam = modeDef.group === 'exam';
  const minutes = Math.ceil(n * minutesPerQuestion);

  let reason = '';
  if (loadFailed) reason = loadFailed;
  else if (!loaded) reason = 'Loading the questions…';
  else if (course.total === 0) reason = free ? 'No free questions in this course yet.' : 'No questions in this course yet.';
  else if (way === 'keyword' && !typed) reason = 'Type a word to find questions.';
  else if (searching) reason = 'Searching…';
  else if (matching === 0) reason = way === 'keyword' && !kwPool.length ? `No question contains “${typed}”.` : 'No questions match. Untick a filter.';
  else if (!enough) reason = `Only ${matching} ${matching === 1 ? 'question matches' : 'questions match'}. Untick a filter or clear the keyword.`;
  const ready = !reason;

  const selection =
    way === 'topic'
      ? pickedTopics.length
        ? shortList(pickedTopics)
        : 'All topics'
      : typed
        ? `“${typed}”${pickedKw.length ? ` in ${shortList(pickedKw)}` : ''}`
        : 'type a word';
  // The card and the circles have room for one name: "Community Health +6 more".
  const oneAndMore = (names: string[]) => (names.length <= 1 ? names.join('') : `${names[0]} +${names.length - 1} more`);
  const selectionShort =
    way === 'topic'
      ? pickedTopics.length
        ? oneAndMore(pickedTopics)
        : 'All topics'
      : typed
        ? `“${typed}”${pickedKw.length ? ` in ${oneAndMore(pickedKw)}` : ''}`
        : 'type a word';
  const quizName = `${course.title} · ${selection} · ${questions(n)}`;

  // ── each step's choice, under its circle ──
  const courseLine = course.title + (free ? ' · free questions' : '');
  const filtersLine = [
    which === 'all' ? 'All questions' : WHICH.find((w) => w.id === which)!.label,
    diffs.length ? diffs.join(', ') : 'any difficulty',
    types.length ? types.map((t) => TYPE_LABEL[t] || t).join(', ') : 'any type',
  ].join(' · ');

  // ── "Your quiz", the card on the right (a computer); the phone's bar keeps one line ──
  const chosenFilters = [...diffs, ...types.map((t) => TYPE_LABEL[t] || t)];
  // [label, value, the step that changes it] — the old Review step's Edit links
  const recap: [string, string, number][] = [
    ['Course', course.title, 0],
    way === 'topic' ? ['Topics', selectionShort, 1] : ['Keyword', typed ? selectionShort : '—', 1],
    ['Questions', WHICH.find((w) => w.id === which)!.label + (free ? ' · free only' : ''), 2],
    ['Filters', chosenFilters.length ? chosenFilters.join(', ') : 'Any', 2],
    ['Mode', `${modeDef.groupLabel} · ${modeDef.name}`, 3],
  ];
  const clockText = exam ? `${minutes} min` : 'no clock';
  const trialNote =
    course.reason === 'trial' && course.quizzesLeft
      ? course.quizzesLeft === 1
        ? 'Uses your last trial quiz.'
        : `Uses one of your ${course.quizzesLeft} trial quizzes left.`
      : '';
  const countNote = !enough
    ? `A quiz needs at least ${MIN} questions.`
    : matching < maxQuestions
      ? `Only ${matching} questions match, so this quiz can have up to ${matching}.`
      : `Between ${MIN} and ${maxQuestions} questions.`;

  function goStep(i: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    setExamNote(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const stepValues = [courseLine, selectionShort, filtersLine, `${modeDef.name} · ${enough ? n : '—'}`];

  function pickCourse(id: string) {
    if (id === courseId) return;
    setCourseId(id);
    setTopics([]);
    setKwTopics([]);
    setWord('');
    setTopicFind('');
    setExamNote(false);
  }

  function repeatLast() {
    if (!last || !lastCourse) return;
    setCourseId(last.courseId);
    setWay(last.way === 'keyword' ? 'keyword' : 'topic');
    setTopics(last.topics || []);
    setWord(last.word || '');
    setKwTopics(last.kwTopics || []);
    setWhich(last.which || 'all');
    setDiffs(last.diffs || []);
    setTypes(last.types || []);
    setMode(MODE_ORDER.includes(last.mode) ? last.mode : 'UNTIMED_LEARNING');
    setCount(Number(last.count) || COUNT_DEFAULT);
    setTopicFind('');
    setStep(STEPS.length - 1);
  }

  async function start() {
    if (!ready || building) return;
    setBuilding(true);
    const chosen = shuffle(finalPool)
      .slice(0, n)
      .map((i) => i.item_id);
    const result = await startQuizBuilderQuiz(courseId, chosen, modeNow, quizName);
    if (!result.ok) {
      setToast(result.error);
      setBuilding(false);
      return;
    }
    saveLast(userKey, { courseId, way, topics: pickedTopics, word: typed, kwTopics: pickedKw, which, diffs, types, mode: modeNow, count: n });
    router.push(sessionHref(result.attemptId));
  }

  // ── the topic tiles ──
  const topicList = ranked(topicCounts);
  const find = topicFind.trim().toLowerCase();
  const shownTopics = find ? topicList.filter(([t]) => t.toLowerCase().includes(find)) : topicList;
  const unticked = find ? shownTopics.map(([t]) => t).filter((t) => !pickedTopics.includes(t)) : [];
  const kwList = ranked(kwTopicCounts);

  const lastSummary = last && lastCourse
    ? `${lastCourse.title} · ${last.way === 'keyword' ? `“${last.word}”` : last.topics?.length ? shortList(last.topics) : 'All topics'} · ${last.count} · ${modeOf(last.mode).name}`
    : '';

  return (
    <div className="qb">
      <div className="qb-main">
        <p className="qb-intro">Pick what to practise and how. The count updates as you go.</p>
        <Banner course={course} />

        {lastCourse ? (
          <button type="button" className="card qb-quick" onClick={repeatLast}>
            <span className="qb-quick-tile" aria-hidden="true">
              <Icon name="refresh" />
            </span>
            <span className="qb-quick-text">
              <span className="qb-quick-title">Repeat your last setup</span>
              <span className="qb-quick-sub">{lastSummary}</span>
            </span>
          </button>
        ) : null}

        <ol className="qb-steps" aria-label="Quiz builder steps">
          {STEPS.map((s, i) => (
            <li key={s.id} className={`qb-steps-item${i < step ? ' is-done' : ''}${i === step ? ' is-now' : ''}`}>
              <button type="button" className="qb-steps-btn" aria-current={i === step ? 'step' : undefined} onClick={() => goStep(i)}>
                <span className="qb-steps-dot" aria-hidden="true">
                  {i < step ? '✓' : i + 1}
                </span>
                <span className="qb-steps-name">
                  <span className="qb-phone">{s.short}</span>
                  <span className="qb-wide">{s.name}</span>
                </span>
                <span className="qb-steps-value qb-wide">{stepValues[i]}</span>
              </button>
            </li>
          ))}
        </ol>

        <section className="card qb-panel" aria-labelledby="qb-panel-title">
          <div className="qb-panel-head">
            <p className="qb-panel-kicker">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="qb-panel-title" id="qb-panel-title">
              {STEPS[step].name}
            </h2>
          </div>

          {step === 0 ? (
            <div className="qb-options">
              {courses.map((c) => {
                const on = c.course_id === courseId;
                const none = c.total === 0;
                return (
                  <button
                    key={c.course_id}
                    type="button"
                    className={on ? 'qb-option is-on' : 'qb-option'}
                    aria-pressed={on}
                    disabled={none && !on}
                    onClick={() => pickCourse(c.course_id)}
                  >
                    <span className="qb-radio" aria-hidden="true" />
                    <span className="qb-option-text">
                      <span className="qb-option-title">{c.title}</span>
                      <span className="qb-option-count">
                        {none ? (c.pool === 'free' ? 'No free questions yet' : 'No questions yet') : c.pool === 'free' ? `${c.total.toLocaleString('en-GB')} free` : questions(c.total)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 1 ? (
            <>
              <div className="qb-seg" role="group" aria-label="Choose questions">
                <button type="button" className={way === 'topic' ? 'qb-seg-btn is-on' : 'qb-seg-btn'} aria-pressed={way === 'topic'} onClick={() => setWay('topic')}>
                  By topic
                </button>
                <button type="button" className={way === 'keyword' ? 'qb-seg-btn is-on' : 'qb-seg-btn'} aria-pressed={way === 'keyword'} onClick={() => setWay('keyword')}>
                  By keyword
                </button>
              </div>

              {!loaded && !loadFailed ? <p className="qb-meta">Loading the questions…</p> : null}
              {loadFailed ? (
                <p className="qb-meta">
                  {loadFailed}{' '}
                  <button type="button" className="btn btn-link qb-more" onClick={retryLoad}>
                    Try again
                  </button>
                </p>
              ) : null}

              {way === 'topic' ? (
                <div className="qb-block">
                  <div className="qb-topic-tools">
                    {topicList.length > TOPICS_SHOWN ? (
                      <div className="qb-field qb-topic-find">
                        <label htmlFor="qb-find" className="qb-label">
                          Find a topic
                        </label>
                        <div className="qb-input-wrap">
                          <Icon name="search" className="qb-input-icon" />
                          <input
                            id="qb-find"
                            type="text"
                            className="qb-input"
                            autoComplete="off"
                            placeholder="Search this list"
                            value={topicFind}
                            onChange={(e) => setTopicFind(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {unticked.length ? (
                      <button type="button" className="btn btn-lite qb-tool-btn" onClick={() => setTopics((s) => [...new Set([...s, ...unticked])])}>
                        Tick all {shownTopics.length} shown
                      </button>
                    ) : null}
                    {pickedTopics.length ? (
                      <button type="button" className="btn btn-lite qb-tool-btn" onClick={() => setTopics([])}>
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="qb-tiles" role="group" aria-label="Topics">
                    {!find ? <TopicTile wide label="All topics" count={loaded ? pool.length : undefined} pressed={!pickedTopics.length} onClick={() => setTopics([])} /> : null}
                    {shownTopics.map(([t, c]) => (
                      <TopicTile key={t} label={t} count={c} pressed={pickedTopics.includes(t)} onClick={() => setTopics((s) => toggleIn(s, t))} />
                    ))}
                    {find && !shownTopics.length ? <p className="qb-meta qb-tiles-empty">No topic has “{topicFind.trim()}” in its name.</p> : null}
                  </div>
                </div>
              ) : (
                <div className="qb-block">
                  <div className="qb-field">
                    <label htmlFor="qb-word" className="qb-label">
                      Keyword <span className="qb-label-soft">(optional)</span>
                    </label>
                    <div className="qb-input-wrap">
                      <Icon name="search" className="qb-input-icon" />
                      <input
                        id="qb-word"
                        type="text"
                        className="qb-input"
                        autoComplete="off"
                        placeholder="Type a word, e.g. malaria"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                      />
                      {word ? (
                        <button type="button" className="qb-input-clear" aria-label="Clear the keyword" onClick={() => setWord('')}>
                          <Icon name="x" />
                        </button>
                      ) : null}
                    </div>
                    {typed ? (
                      <p className={kwReady && !kwPool.length ? 'qb-kw-line is-none' : 'qb-kw-line'} aria-live="polite">
                        {searching ? 'Searching…' : kwPool.length ? `${questions(kwPool.length)} contain “${typed}”` : `No question contains “${typed}”`}
                      </p>
                    ) : null}
                    <p className="qb-meta">
                      {!typed
                        ? 'Finds every question with a word starting this way — in the question, its explanation or its topic.'
                        : kwPool.length
                          ? 'They are in the topics below. Tick some to narrow it down, or leave All.'
                          : 'Try the start of the word: “malar” finds malaria and malarial.'}
                    </p>
                  </div>
                  {kwPool.length ? (
                    <>
                      <p className="qb-label">Topics with “{typed}”</p>
                      <div className="qb-tiles" role="group" aria-label={`Topics with ${typed}`}>
                        <TopicTile wide label={`All ${kwList.length} ${kwList.length === 1 ? 'topic' : 'topics'}`} count={kwPool.length} pressed={!pickedKw.length} onClick={() => setKwTopics([])} />
                        {kwList.map(([t, c]) => (
                          <TopicTile key={t} label={t} count={c} pressed={pickedKw.includes(t)} onClick={() => setKwTopics((s) => toggleIn(s, t))} />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="qb-label">Which questions</p>
              <div className="qb-chips">
                {WHICH.map((w) => (
                  <Chip key={w.id} label={w.label} count={whichCounts.get(w.id) ?? 0} pressed={which === w.id} onClick={() => setWhich(w.id)} />
                ))}
              </div>
              <p className="qb-label">Difficulty</p>
              <div className="qb-chips">
                {diffNames.map((d) => (
                  <Chip key={d} label={d} count={diffCounts.get(d) ?? 0} pressed={diffs.includes(d)} onClick={() => setDiffs((s) => toggleIn(s, d))} />
                ))}
              </div>
              <p className="qb-label">Question type</p>
              <div className="qb-chips">
                {typeNames.map((t) => (
                  <Chip key={t} label={TYPE_LABEL[t] || t} count={typeCounts.get(t) ?? 0} pressed={types.includes(t)} onClick={() => setTypes((s) => toggleIn(s, t))} />
                ))}
              </div>
              <p className="qb-meta">Leave a row unticked to include everything in it.</p>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="qb-mode-cols">
                <div className="qb-mode-group">
                  <p className="qb-label">Study</p>
                  <div className="qb-modes">
                    {MODE_ORDER.filter((m) => MODES[m].group === 'study').map((m) => (
                      <ModeCard key={m} mode={MODES[m]} pressed={modeNow === m} locked={false} onClick={() => { setMode(m); setExamNote(false); }} />
                    ))}
                  </div>
                </div>
                <div className="qb-mode-group">
                  <p className="qb-label">Exam</p>
                  <div className="qb-modes">
                    {MODE_ORDER.filter((m) => MODES[m].group === 'exam').map((m) => (
                      <ModeCard
                        key={m}
                        mode={MODES[m]}
                        pressed={modeNow === m}
                        locked={free}
                        onClick={() => (free ? setExamNote(true) : setMode(m))}
                      />
                    ))}
                  </div>
                  {free ? (
                    <p id="qb-exam-locked" className={examNote ? 'qb-note is-shown' : 'qb-note'}>
                      The exam modes open with a package.{' '}
                      <AppLink href={PACKAGES_HREF} className="qb-note-link">
                        Choose a package
                      </AppLink>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="qb-howmany">
                <p className="qb-label" id="qb-count-title">
                  How many questions
                </p>
                <div className="qb-count-controls" role="group" aria-labelledby="qb-count-title">
                  <div className="qb-stepper">
                    <button type="button" className="btn btn-ghost btn-lg qb-step" aria-label="Five fewer" disabled={!enough || n <= MIN} onClick={() => setCount(Math.max(MIN, n - COUNT_STEP))}>
                      −
                    </button>
                    <span className="qb-count-num" aria-live="polite">
                      {enough ? n : '—'}
                    </span>
                    <button type="button" className="btn btn-ghost btn-lg qb-step" aria-label="Five more" disabled={!enough || n >= cap} onClick={() => setCount(Math.min(cap, n + COUNT_STEP))}>
                      +
                    </button>
                  </div>
                  <div className="qb-chips">
                    {COUNT_PICKS.filter((v) => v <= maxQuestions).map((v) => (
                      <Chip key={v} label={String(v)} pressed={enough && n === v} disabled={v > matching} onClick={() => setCount(v)} />
                    ))}
                  </div>
                </div>
                <p className="qb-meta">{countNote}</p>
              </div>

              <div className="qb-review qb-phone">
                <p className="qb-label">Your quiz</p>
                <Recap rows={recap} onChange={goStep} />
              </div>
            </>
          ) : null}

          <div className="qb-nav">
            {step > 0 ? (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => goStep(step - 1)}>
                ← Back
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-outline btn-lg" onClick={() => goStep(step + 1)}>
                Next: {STEPS[step + 1].name} →
              </button>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="qb-side" aria-label="Your quiz">
        <div className="card qb-bar">
          <p className="qb-bar-label qb-wide">Your quiz</p>
          <p className="qb-bar-big qb-wide">
            <span className="qb-bar-num">{loaded ? matching.toLocaleString('en-GB') : '…'}</span>
            <span className="qb-bar-word">{matching === 1 ? 'question matches' : 'questions match'}</span>
          </p>
          <Recap rows={recap} onChange={goStep} className="qb-wide" />
          <div className="qb-bar-text">
            <span className="qb-bar-count qb-phone">{loaded ? `${matching.toLocaleString('en-GB')} ${matching === 1 ? 'question matches' : 'questions match'}` : 'Loading…'}</span>
            <span className={ready ? 'qb-bar-line' : 'qb-bar-line is-warn'}>
              {ready ? (
                <>
                  {questions(n)} · <span className="qb-phone">{modeDef.name} · </span>
                  {clockText}
                </>
              ) : (
                reason
              )}
            </span>
          </div>
          <button type="button" className="btn btn-accent btn-lg qb-start" disabled={!ready || building} onClick={() => void start()}>
            {building ? 'Starting…' : exam ? 'Start exam' : 'Start quiz'}
            {building ? null : <ArrowRight />}
          </button>
          {trialNote ? <p className="qb-trial-note qb-wide">{trialNote}</p> : null}
        </div>
      </aside>

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}
