// components/runner/quiz-runner.tsx
//
// The runner core — the script block of legacy runner/instant.html and
// runner/timed.html, which were one script with two modes (slice 6a
// builds the core and the instant mode; 6b adds the timed pieces where
// `mode === 'timed'`). One component, two pages, each page's own words
// (rebuild.md §12 slice 6, Sam 2026-09-13).
//
// What it does, in legacy's order: the preflight card (or straight in,
// when the student ticked "Don't show this again"); pages of N questions
// from config; the per-attempt seeded option order; MCQ / TF feedback on
// answer and the SATA "Check Answer" gate (instant); flags; the question
// grid as a desktop column or a phone overlay, with All / Flagged views;
// the Inline / Standalone / Hide feedback switch remembered in the
// browser; the exit dialog (save and resume later, or submit and exit);
// submit with legacy's two confirm() questions; the score card; review
// mode; the admin preview path (no writes). Scores shown after submit
// are the database's (finish_attempt grades every row in SQL); before
// that the browser's own arithmetic drives the live feedback.
//
// Saving, since 03 Q5: one patch per question, half a second after the
// last tap on it (legacy's autosave timer restarted on every answer, so
// steady answering never saved — legacy-check gap 1); a flag and a page
// turn flush at once; instant mode's Check Answer (the pick itself for
// MCQ / TF, the button for SATA) is one server call that writes and
// grades the row. A failed Submit shows a toast and lets the student
// try again (gap 2). The browser holds no write on any attempt table.
//
// The seal, since 03 Q6 (D5): the questions arrive as SealedItem — no
// key, no rationale, no per-option feedback — and the secret half lives
// in `secrets`, a map the server fills: empty for a live exam, the
// questions already checked for a live instant attempt, every question
// in review. Check Answer's reply and the finish reply add to it. The
// type has no `correct`, so nothing here can read the key off a
// question; a timed exam's page source carries none.
//
// "Send feedback" under each question (slice 12a): builds legacy's
// reference text — the stem, the options as shown and the student's
// current answer, never the correct one — saves progress, then opens
// the messages page in a new tab with the course, attempt, quiz and
// item ids and the quoted question (locked or review: opens at once).
// Legacy's brand string in the header and the watermark read
// "QAcademy"; the brand is Quademia (AGENTS.md UI convention #5).

'use client';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { Toast } from '@/lib/toast/toast';
import { checkAnswer, expireAttempt, finishAttempt, saveAnswers, startTimedAttempt } from '@/lib/attempts/actions';
import { RunnerError } from './runner-error';
import {
  chosenToStored,
  countAnswered,
  displayLetter,
  getShuffledOptions,
  gradeFor,
  hydrateFromRows,
  isCorrectAnswer,
  isCorrectOption,
  optionFeedback,
  type OptionView,
} from '@/lib/attempts/scoring';
import type { AnswerPatch, Attempt, AttemptMode, ChosenMap, FlagMap, Score, SealedItem, SecretsMap } from '@/lib/attempts/types';

type FeedbackMode = 'inline' | 'standalone' | 'hide';
type ViewMode = 'ALL' | 'FLAGGED';

const FEEDBACK_KEY = 'qa_feedback_mode';
/** A question's save lands this long after the last tap on it. */
const SAVE_DEBOUNCE_MS = 500;
/** The timed auto-submit, when it fails, tries again after this long. */
const AUTO_SUBMIT_RETRY_MS = 10_000;
const SKIP_KEY: Record<AttemptMode, string> = { instant: 'qa_skip_preflight', timed: 'qa_skip_preflight_timed' };
const QUIZZES_PAGE = '/student/fixed-quizzes';

const WORDS = {
  instant: {
    title: 'Practice Quiz',
    modeWord: 'Practice',
    start: '▶ Start Quiz',
    resume: '▶ Resume Attempt',
    preflightText: 'Practice mode gives you immediate feedback after each answer. You can flag questions, navigate freely and review your answers at the end.',
    reviewBanner: 'Review Mode — Answers are read-only. You are reviewing a completed attempt.',
    submit: 'Submit Quiz',
    flaggedEmptySub: 'Flag questions during the quiz, then switch back here to review only those questions.',
    exitTitle: 'Leave this quiz?',
    exitText: 'Your progress will be saved and you can resume later from your learning history.',
    reviewingLog: 'Reviewing your completed attempt. All answers and feedback are shown read-only.',
    submittedLog: 'Quiz submitted. Review your answers below.',
    savedLog: 'Progress saved. You can resume from your learning history.',
  },
  timed: {
    title: 'Exam Quiz',
    modeWord: 'Exam',
    start: '🎯 Start Exam',
    resume: '🎯 Resume Exam',
    preflightText: '',
    reviewBanner: 'Review Mode — Answers are read-only. You are reviewing a completed exam attempt.',
    submit: 'Submit Exam',
    flaggedEmptySub: 'Flag questions during the exam, then switch back here to review only those questions.',
    exitTitle: 'Leave this exam?',
    exitText: 'The timer will keep running. Your progress will be saved and you can resume from your learning history — but the clock does not stop.',
    reviewingLog: 'Reviewing your completed exam. All answers and feedback are shown read-only.',
    submittedLog: 'Exam submitted. Review your answers below.',
    savedLog: 'Progress saved.',
  },
} as const;

function feedbackModeLabel(m: FeedbackMode): string {
  if (m === 'standalone') return 'Standalone feedback';
  if (m === 'hide') return 'Hide explanations';
  return 'Inline feedback';
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
}

export function QuizRunner({
  mode,
  attempt,
  items,
  secrets: initialSecrets,
  questionsPerPage,
  reviewMode,
  previewMode,
}: {
  mode: AttemptMode;
  attempt: Attempt;
  items: SealedItem[];
  secrets: SecretsMap;
  questionsPerPage: number;
  reviewMode: boolean;
  previewMode: boolean;
}) {
  const router = useRouter();
  const W = WORDS[mode];
  const label = attempt.display_label || W.title;

  // ── state (legacy ANSW / FLAGS / SATA_EVAL / LOCKED / …) ──
  const hydrated = useMemo(() => hydrateFromRows(items), [items]);
  const [secrets, setSecrets] = useState<SecretsMap>(initialSecrets);
  const [answers, setAnswers] = useState<ChosenMap>(hydrated.answers);
  const [flags, setFlags] = useState<FlagMap>(hydrated.flags);
  const [sataChecked, setSataChecked] = useState<FlagMap>(hydrated.sataChecked);
  const [locked, setLocked] = useState(reviewMode);
  const [finishSent, setFinishSent] = useState(false);
  const [booted, setBooted] = useState(false);
  const [phase, setPhase] = useState<'init' | 'preflight' | 'quiz'>('init');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('ALL');
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('inline');
  const [scoreCardOpen, setScoreCardOpen] = useState(false);
  const [serverScore, setServerScore] = useState<Score | null>(null);
  const [gridOverlayOpen, setGridOverlayOpen] = useState(false);
  const [desktopGridHidden, setDesktopGridHidden] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [imgOverlay, setImgOverlay] = useState('');
  const [skipNextTime, setSkipNextTime] = useState(false);
  const [status, setStatus] = useState('Initialising…');
  const [saving, setSaving] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const startedAtRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const finishingRef = useRef(false);
  const lastAutoSubmitRef = useRef(0);
  // The save queue (03 Q5): one pending patch per question, flushed half
  // a second after the last tap, or at once by a flag or a page turn.
  const pendingRef = useRef<Map<string, AnswerPatch>>(new Map());
  const flushTimerRef = useRef<number | null>(null);
  const totalSeconds = (attempt.duration_min || items.length) * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [timeUp, setTimeUp] = useState(false);
  const [startError, setStartError] = useState('');
  const headerRef = useRef<HTMLDivElement>(null);

  // legacy buildShufCache: the option order per item, once per attempt.
  const shuffled = useMemo(() => {
    const map: Record<string, OptionView[]> = {};
    for (const item of items) map[item.item_id] = getShuffledOptions(item, attempt.attempt_id);
    return map;
  }, [items, attempt.attempt_id]);

  // ── init (legacy initQuizMode / initReviewMode), after the first paint
  // because it reads localStorage ──
  useEffect(() => {
    const id = window.setTimeout(() => {
      let fb: FeedbackMode = 'inline';
      try {
        const saved = window.localStorage.getItem(FEEDBACK_KEY) || '';
        if (saved === 'inline' || saved === 'standalone' || saved === 'hide') fb = saved;
      } catch {
        /* no storage — inline */
      }
      setFeedbackMode(fb);

      if (reviewMode) {
        setPhase('quiz');
        setBooted(true);
        setScoreCardOpen(true);
        if (!isDesktop()) setGridOverlayOpen(true);
        setStatus(W.reviewingLog);
        return;
      }

      let skip = false;
      try {
        skip = window.localStorage.getItem(SKIP_KEY[mode]) === '1';
      } catch {
        /* no storage — show the card */
      }
      if (skip) {
        startQuiz(true);
      } else {
        setPhase('preflight');
        setStatus(
          mode === 'timed'
            ? attempt.started_utc !== null
              ? 'You have an in-progress exam. Click Resume Exam when ready.'
              : 'Read the exam details carefully then click Start Exam when ready.'
            : hasProgress()
            ? 'You have an in-progress attempt. Click Resume Attempt when ready.'
            : 'Review the quiz details then click Start Quiz when ready.',
        );
      }
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount
  }, []);

  function hasProgress(): boolean {
    return Object.keys(answers).length > 0 || Object.keys(flags).length > 0 || Object.keys(sataChecked).length > 0;
  }

  async function startQuiz(skipped = false) {
    if (booted || startingRef.current) return;
    startingRef.current = true;
    if (mode === 'timed') {
      setSaving('Starting your exam…');
      try {
        // Admin preview runs only in memory and never stamps an attempt.
        const result = previewMode
          ? { ok: true as const, startedIso: attempt.started_utc ?? new Date().toISOString() }
          : await startTimedAttempt(attempt.attempt_id);
        if (!result.ok) {
          setStartError(result.error);
          return;
        }
        startedAtRef.current = new Date(result.startedIso).getTime();
        setSecondsLeft(Math.max(0, totalSeconds - Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))));
      } catch {
        setStartError('We could not start your exam properly. Please try again.');
        return;
      } finally {
        setSaving('');
        startingRef.current = false;
      }
    }
    setBooted(true);
    setPhase('quiz');
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    setPage(0);
    setViewMode('ALL');
    if (mode === 'timed') {
      setStatus(attempt.started_utc !== null
        ? 'Resuming your in-progress exam. Your saved answers have been restored.'
        : '');
    } else if (skipped && hasProgress()) setStatus('Resuming your in-progress attempt. Your saved answers have been restored.');
  }

  function onPreflightStart() {
    if (skipNextTime) {
      try {
        window.localStorage.setItem(SKIP_KEY[mode], '1');
      } catch {
        /* ignore */
      }
    }
    startQuiz(false);
  }

  // ── derived (legacy getCurrentSource / getGridStats / paging) ──
  const source = viewMode === 'FLAGGED' ? items.filter((i) => flags[i.item_id]) : items;
  const totalPages = Math.max(1, Math.ceil(Math.max(source.length, 1) / questionsPerPage));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const allPageCount = Math.max(1, Math.ceil(items.length / questionsPerPage));
  const answered = countAnswered(items, answers);
  const flaggedCount = items.filter((i) => flags[i.item_id]).length;
  const unanswered = Math.max(0, items.length - answered);
  const pct = items.length > 0 ? Math.round((answered / items.length) * 100) : 0;
  const showSubmit = !locked && !reviewMode && viewMode === 'ALL' && safePage >= allPageCount - 1;
  // The score is the database's: the finish reply, or the header's stored
  // figures in review. No browser-side arithmetic (Q6 — it has no key).
  const storedScore: Score | null =
    attempt.score_pct !== null && attempt.score_raw !== null && attempt.score_total !== null
      ? { raw: Number(attempt.score_raw), total: Number(attempt.score_total), pct: Number(attempt.score_pct) }
      : null;
  const score: Score = serverScore ?? storedScore ?? { raw: 0, total: 0, pct: 0 };
  const showAlways = locked || reviewMode || finishSent;

  // ── save (03 Q5; legacy saveInProgress) ──
  // Best effort: a failed flush is logged, its patches kept for the next
  // flush, and Submit surfaces a real error.
  const flushSaves = useCallback(async (): Promise<boolean> => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (previewMode) return true;
    const rows = [...pendingRef.current.values()];
    pendingRef.current = new Map();
    if (!rows.length) return true;
    const result = await saveAnswers(attempt.attempt_id, rows);
    if (!result.ok) {
      console.warn('saveAnswers failed:', result.error);
      for (const r of rows) if (!pendingRef.current.has(r.item_id)) pendingRef.current.set(r.item_id, r);
    }
    return result.ok;
  }, [previewMode, attempt.attempt_id]);

  function queueSave(patch: AnswerPatch, immediate = false) {
    if (previewMode || locked || reviewMode) return;
    const prev = pendingRef.current.get(patch.item_id) ?? { item_id: patch.item_id };
    pendingRef.current.set(patch.item_id, { ...prev, ...patch });
    if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
    if (immediate) {
      flushTimerRef.current = null;
      void flushSaves();
      return;
    }
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      void flushSaves();
    }, SAVE_DEBOUNCE_MS);
  }

  const saveProgress = useCallback(
    async (showMsg: boolean) => {
      const ok = await flushSaves();
      if (showMsg) setStatus(ok ? W.savedLog : 'Save failed. Please check your connection and try again.');
      return ok;
    },
    [flushSaves, W.savedLog],
  );

  // Read the latest answers on expiry without restarting the interval
  // on every answer. Recalculate from the saved start, never tick down
  // a counter: a sleeping/background tab must not gain time.
  const onTimerTick = useEffectEvent(() => {
    if (finishingRef.current || startedAtRef.current === null) return;
    const left = Math.max(0, totalSeconds - Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    setSecondsLeft(left);
    if (left <= 0) void submitQuiz(true);
  });

  useEffect(() => {
    if (mode !== 'timed' || !booted || locked || reviewMode) return;
    const first = window.setTimeout(() => onTimerTick(), 0);
    const id = window.setInterval(() => onTimerTick(), 1000);
    const wake = () => onTimerTick();
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [mode, booted, locked, reviewMode]);

  // legacy beforeunload guard — for a closed tab or a typed address, not
  // for our own exit. Save & Resume Later and Submit & Exit leave by a
  // full load, which used to trip this guard too, so a student who had
  // just saved was told their changes may not be saved (legacy did the
  // same; fixed with DS4, Sam 2026-09-22). The ref is set in the exit
  // handlers before they navigate.
  const leavingRef = useRef(false);
  useEffect(() => {
    if (!booted || locked || reviewMode) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [booted, locked, reviewMode]);

  function scrollToTop() {
    window.scrollTo({ top: headerRef.current?.offsetHeight ?? 0, behavior: 'smooth' });
  }

  function gotoPage(n: number) {
    setPage(n);
    scrollToTop();
  }

  function prevPage() {
    if (safePage > 0) {
      void saveProgress(false);
      gotoPage(safePage - 1);
    }
  }

  function nextPage() {
    if (safePage < totalPages - 1) {
      void saveProgress(false);
      gotoPage(safePage + 1);
    }
  }

  function changeViewMode(m: ViewMode) {
    setViewMode(m);
    setPage(0);
  }

  // ── answering ──
  function choose(item: SealedItem, letter: string, checked: boolean) {
    if (locked || reviewMode) return;
    if (item.question_type === 'SATA') {
      const current = Array.isArray(answers[item.item_id]) ? [...(answers[item.item_id] as string[])] : [];
      const next = checked ? (current.includes(letter) ? current : [...current, letter]) : current.filter((l) => l !== letter);
      setAnswers((a) => {
        const copy = { ...a };
        if (next.length) copy[item.item_id] = next;
        else delete copy[item.item_id];
        return copy;
      });
      // instant: the reveal waits for Check Answer again
      setSataChecked((s) => ({ ...s, [item.item_id]: false }));
      queueSave({ item_id: item.item_id, chosen: chosenToStored(next), sata_checked: false });
      return;
    }
    setAnswers((a) => ({ ...a, [item.item_id]: letter }));
    if (mode === 'instant' && !previewMode) {
      // The pick is the check for an MCQ / TF (legacy revealed on answer):
      // the server writes and grades the row and returns its secret half,
      // which is what reveals the feedback (Q6). A failure falls back to
      // the plain save so the answer still lands, and says so.
      void checkAnswer(item.attempt_item_id, letter).then((r) => {
        if (r.ok) setSecrets((s) => ({ ...s, [item.item_id]: r.secret }));
        else {
          queueSave({ item_id: item.item_id, chosen: letter });
          setToast(`Could not check this answer: ${r.error}`);
        }
      });
    } else {
      queueSave({ item_id: item.item_id, chosen: letter });
    }
  }

  function checkSata(item: SealedItem) {
    const chosen = answers[item.item_id];
    if (!Array.isArray(chosen) || chosen.length === 0) return;
    setSataChecked((s) => ({ ...s, [item.item_id]: true }));
    if (previewMode) return;
    // The check writes the answer itself; a pending save for this row
    // would only overwrite sata_checked with false.
    pendingRef.current.delete(item.item_id);
    void checkAnswer(item.attempt_item_id, chosen, true).then((r) => {
      if (r.ok) setSecrets((s) => ({ ...s, [item.item_id]: r.secret }));
      else {
        queueSave({ item_id: item.item_id, chosen: chosenToStored(chosen), sata_checked: true });
        setToast(`Could not check this answer: ${r.error}`);
      }
    });
  }

  function toggleFlag(item: SealedItem) {
    const next = !flags[item.item_id];
    setFlags((f) => ({ ...f, [item.item_id]: next }));
    queueSave({ item_id: item.item_id, flagged: next }, true);
  }

  // ── submit (legacy confirmSubmit / submitQuiz) ──
  // In the app's dialog (DS4). Legacy's flagged message said "Click
  // Cancel to go back and review them, or OK to continue", which cannot
  // survive buttons with real labels; Sam's wording (2026-09-22) puts the
  // two choices on the buttons instead.
  const [confirm, confirmDialog] = useConfirm();
  async function confirmSubmit() {
    if (flaggedCount > 0) {
      const goOn = await confirm({
        title: `You still have ${flaggedCount} flagged question${flaggedCount !== 1 ? 's' : ''}`,
        confirmLabel: 'Submit anyway',
        cancelLabel: 'Go back and review',
      });
      if (!goOn) return;
    }
    if (unanswered > 0) {
      const goOn = await confirm({
        title: `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}`,
        body: 'Submit anyway?',
        confirmLabel: 'Submit anyway',
        cancelLabel: 'Go back',
      });
      if (!goOn) return;
    }
    void submitQuiz();
  }

  // Submit (or the exam's auto-submit): the pending saves first, then one
  // call — finish_attempt grades every row, expire_attempt closes an exam
  // at its deadline. A failure unlocks the runner and shows a toast; the
  // answers are saved, so trying again loses nothing (gap 2). The
  // auto-submit retries on its own every AUTO_SUBMIT_RETRY_MS.
  async function submitQuiz(autoSubmit = false): Promise<boolean> {
    if (finishSent || locked || finishingRef.current) return false;
    if (autoSubmit && Date.now() - lastAutoSubmitRef.current < AUTO_SUBMIT_RETRY_MS) return false;
    lastAutoSubmitRef.current = Date.now();
    finishingRef.current = true;
    setExitOpen(false);
    setGridOverlayOpen(false);
    setSaving('submitting');

    const timeTakenS = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : null;

    if (!previewMode) {
      await flushSaves();
      const result = autoSubmit ? await expireAttempt(attempt.attempt_id) : await finishAttempt(attempt.attempt_id, timeTakenS);
      if (!result.ok) {
        finishingRef.current = false;
        setSaving('');
        setToast(`Could not submit: ${result.error} Your answers are saved — please try again.`);
        setStatus('Submit failed. Your answers are saved; please try again.');
        return false;
      }
      setServerScore(result.score);
      // The sitting is over: every question's secret half arrives with
      // the score, so the review renders without a reload (Q6).
      setSecrets((s) => ({ ...s, ...result.secrets }));
    }
    if (autoSubmit) setTimeUp(true);
    setFinishSent(true);
    setLocked(true);
    setSaving('');
    setScoreCardOpen(true);
    setStatus(autoSubmit ? 'Time is up. Your exam has been submitted automatically.' : W.submittedLog);
    return true;
  }

  function reviewAnswers() {
    setScoreCardOpen(false);
    setPage(0);
  }

  // ── exit (legacy handleExit / saveAndExit / submitAndExit) ──
  function handleExit() {
    if (locked || reviewMode) {
      router.push(QUIZZES_PAGE);
      return;
    }
    setExitOpen(true);
  }

  async function saveAndExit() {
    setSaving('Saving your progress…');
    await saveProgress(false);
    setSaving('');
    leavingRef.current = true;
    window.location.href = QUIZZES_PAGE;
  }

  async function submitAndExit() {
    setExitOpen(false);
    const done = await submitQuiz();
    if (!done) return;
    window.setTimeout(() => {
      leavingRef.current = true;
      window.location.href = QUIZZES_PAGE;
    }, 1500);
  }

  // ── grid (legacy openGridOverlay / hideDesktopGrid / showDesktopGrid) ──
  function openGrid() {
    if (isDesktop()) setDesktopGridHidden(false);
    else setGridOverlayOpen(true);
  }

  function changeFeedbackMode(m: FeedbackMode) {
    setFeedbackMode(m);
    try {
      window.localStorage.setItem(FEEDBACK_KEY, m);
    } catch {
      /* ignore */
    }
  }

  // ── pieces ──
  const barClass = locked ? `progress-fill locked ${score.pct >= 70 ? 'green' : score.pct >= 50 ? 'amber' : 'red'}` : 'progress-fill';

  function gridCells() {
    if (viewMode === 'FLAGGED' && source.length === 0) return <div className="grid-empty">No flagged questions yet.</div>;
    return source.map((item, srcIdx) => {
      const globalIdx = items.indexOf(item);
      const chosen = answers[item.item_id];
      const has = item.question_type === 'SATA' ? Array.isArray(chosen) && chosen.length > 0 : Boolean(chosen);
      const classes = ['grid-cell'];
      if (flags[item.item_id]) classes.push('has-flag');
      if (locked || reviewMode) {
        if (!has) classes.push('omitted');
        else {
          // The server's grade on the row first; the key from the secrets
          // map when the row was graded before the final answer changed.
          const secret = secrets[item.item_id];
          const right = secret ? isCorrectAnswer(item.question_type, secret.correct, chosen) : item.is_correct === true;
          classes.push(right ? 'correct' : 'incorrect');
        }
      } else {
        if (has) classes.push('answered');
        if (flags[item.item_id]) classes.push('flagged');
      }
      if (Math.floor(srcIdx / questionsPerPage) === safePage) classes.push('current');
      return (
        <button
          key={item.item_id}
          type="button"
          className={classes.join(' ')}
          onClick={() => {
            gotoPage(Math.floor(srcIdx / questionsPerPage));
            if (!isDesktop()) setGridOverlayOpen(false);
          }}
        >
          {globalIdx + 1}
        </button>
      );
    });
  }

  const gridScoreText = locked ? `${score.raw}/${score.total} (${score.pct}%)` : '';
  const gridToolbar = (
    <div className="grid-toolbar">
      <div className="grid-toggles">
        <button type="button" className={`grid-toggle${viewMode === 'ALL' ? ' active' : ''}`} onClick={() => changeViewMode('ALL')}>All</button>
        <button type="button" className={`grid-toggle${viewMode === 'FLAGGED' ? ' active' : ''}`} onClick={() => changeViewMode('FLAGGED')}>Flagged ({flaggedCount})</button>
      </div>
      <div className="grid-stats">
        <span className="grid-stat">{answered} answered</span>
        <span className="grid-stat">{unanswered} unanswered</span>
        <span className="grid-stat">{flaggedCount} flagged</span>
      </div>
    </div>
  );

  function renderQuestion(item: SealedItem, globalIdx: number) {
    const shown = shuffled[item.item_id] || [];
    const isSATA = item.question_type === 'SATA';
    const chosenRaw = answers[item.item_id];
    const hasAnswer = isSATA ? Array.isArray(chosenRaw) && chosenRaw.length > 0 : Boolean(chosenRaw);
    // The secret half, if the server has sent it for this question (Q6).
    const secret = secrets[item.item_id] ?? null;
    // legacy canReveal: instant reveals on answer (SATA after Check Answer);
    // timed only when locked / review — and, since Q6, only once the
    // secret half is here: without it there is nothing to reveal.
    const wantsReveal = mode === 'instant'
      ? isSATA ? showAlways || (hasAnswer && Boolean(sataChecked[item.item_id])) : showAlways || hasAnswer
      : locked || reviewMode;
    const canReveal = wantsReveal && secret !== null;
    const disabled = locked || reviewMode;

    const opts = shown.map((o) => ({
      ...o,
      fb: optionFeedback(secret, o.letter),
      isCorrect: secret ? isCorrectOption(item.question_type, secret.correct, o.letter) : false,
    }));
    const rat = (secret?.rationale || '').trim();
    const imgUrl = (secret?.rationale_img || '').trim();
    const optFbs = opts.filter((o) => o.fb);
    const showRationale = canReveal && feedbackMode !== 'hide' && (rat || (feedbackMode === 'standalone' && optFbs.length > 0) || imgUrl);

    return (
      <div key={item.item_id} className="q-block">
        <div className="q-meta">
          <span className="q-num">Q{globalIdx + 1} / {items.length}</span>
          <span className="q-type-chip">{item.question_type}</span>
          {item.maintopic ? <span className="q-topic">{item.maintopic}{item.subtopic ? ` › ${item.subtopic}` : ''}</span> : null}
          {flags[item.item_id] ? <span className="q-flag-indicator">🚩</span> : null}
        </div>
        <div className="q-stem">{item.stem}</div>
        {isSATA ? <div className="sata-hint">Select ALL that apply</div> : null}

        <div className="opts">
          {opts.map((opt, j) => {
            const isChosen = isSATA ? Array.isArray(chosenRaw) && chosenRaw.includes(opt.letter) : chosenRaw === opt.letter;
            const classes = ['opt'];
            if (canReveal) {
              if (opt.isCorrect) classes.push('correct');
              else if (isChosen) classes.push('wrong');
            } else if (mode === 'timed' && isChosen) {
              classes.push('selected');
            }
            if (disabled) classes.push('disabled');
            return (
              <label key={opt.letter} className={classes.join(' ')}>
                <div className="opt-row">
                  <input
                    className="opt-input"
                    type={isSATA ? 'checkbox' : 'radio'}
                    name={`opt_${item.item_id}`}
                    value={opt.letter}
                    disabled={disabled}
                    checked={isChosen}
                    onChange={(e) => choose(item, opt.letter, e.target.checked)}
                  />
                  <div className="opt-body">
                    <div className="opt-title">
                      <span className="opt-text"><strong>{displayLetter(j, opt.letter)}.</strong> {opt.text}</span>
                      {canReveal && opt.isCorrect ? <span className="chip chip-correct">✓ Correct answer</span> : null}
                      {canReveal && isChosen && !opt.isCorrect ? <span className="chip chip-wrong">✗ Your choice</span> : null}
                      {canReveal && isChosen && opt.isCorrect ? <span className="chip chip-chosen">✓ Your choice</span> : null}
                    </div>
                    {canReveal && feedbackMode === 'inline' && opt.fb ? <div className="opt-fb">{opt.fb}</div> : null}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {mode === 'instant' && isSATA && !locked && !reviewMode ? (
          <div className="sata-check-row">
            <button type="button" className="btn btn-primary" disabled={!hasAnswer || Boolean(sataChecked[item.item_id])} onClick={() => checkSata(item)}>
              {sataChecked[item.item_id] ? '✓ Answer checked' : 'Check Answer'}
            </button>
            <div className="sata-check-note">Select all answers first, then click Check Answer.</div>
          </div>
        ) : null}

        {showRationale ? (
          <div className="rationale-block">
            {rat ? <div className="rationale-text"><strong>Rationale:</strong> {rat}</div> : null}
            {feedbackMode === 'standalone' && optFbs.length ? (
              <>
                <div className="standalone-opts-title">Why the options:</div>
                {optFbs.map((o) => (
                  <div key={o.letter} className="standalone-opt-line">
                    <strong>{displayLetter(opts.findIndex((x) => x.letter === o.letter), o.letter)}. {o.text}</strong> — {o.fb}
                  </div>
                ))}
              </>
            ) : null}
            {imgUrl ? (
              <div className="rationale-img-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element -- a public bucket URL */}
                <img className="rationale-img-thumb" src={imgUrl} alt="Rationale illustration" loading="lazy" onClick={() => setImgOverlay(imgUrl)} />
                <div className="rationale-img-caption">Tap to enlarge</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="q-footer">
          <div className="q-footer-left">
            <button type="button" className={`btn btn-flag${flags[item.item_id] ? ' flagged' : ''}`} disabled={disabled} onClick={() => toggleFlag(item)}>
              {flags[item.item_id] ? '🚩 Unflag' : '⚑ Flag'}
            </button>
            <button type="button" className="btn-sm-link" onClick={() => sendFeedback(item, globalIdx, opts, chosenRaw)}>
              Send feedback
            </button>
          </div>
          <div className="watermark">Quademia</div>
        </div>
      </div>
    );
  }

  // ── Send feedback (legacy buildFriendlyRefText + the button) ──
  function buildFeedbackRef(item: SealedItem, globalIdx: number, opts: OptionView[], chosenRaw: ChosenMap[string] | undefined): string {
    const lines: string[] = [];
    lines.push(`Quademia — Question feedback (${mode === 'timed' ? 'Timed' : 'Instant'} quiz)`);
    lines.push(`Course: ${attempt.display_label || attempt.course_id || ''}`);
    lines.push(`Question: ${globalIdx + 1} of ${items.length}`);
    const topic = [item.maintopic, item.subtopic].filter(Boolean).join(' › ');
    if (topic) lines.push(`Topic: ${topic}`);
    lines.push('');
    lines.push('Question:');
    lines.push((item.stem || '').slice(0, 900));
    lines.push('');
    lines.push('Options (as shown):');
    const labels = 'ABCDEFGH';
    opts.forEach((opt, i) => {
      lines.push(`${labels[i]}. ${(opt.text || '').slice(0, 360)}`);
    });
    lines.push('');
    if (chosenRaw) {
      if (Array.isArray(chosenRaw)) {
        const picks = chosenRaw.map((letter) => {
          const match = opts.find((o) => o.letter === letter);
          return match ? match.text.slice(0, 120) : letter.toUpperCase();
        });
        lines.push(`My answer: ${picks.join(', ')}`);
      } else {
        const match = opts.find((o) => o.letter === chosenRaw);
        const idx = match ? opts.indexOf(match) : -1;
        const label = idx >= 0 ? labels[idx] : chosenRaw.toUpperCase();
        lines.push(`My answer: ${label} - ${match ? match.text.slice(0, 120) : ''}`);
      }
    } else {
      lines.push('My answer: (not answered yet)');
    }
    return lines.join('\n');
  }

  function sendFeedback(item: SealedItem, globalIdx: number, opts: OptionView[], chosenRaw: ChosenMap[string] | undefined) {
    const ref = buildFeedbackRef(item, globalIdx, opts, chosenRaw);
    const url =
      `/student/messages?course_id=${encodeURIComponent(attempt.course_id)}` +
      `&attempt_id=${encodeURIComponent(attempt.attempt_id)}` +
      `&quiz_id=${encodeURIComponent(attempt.quiz_id || '')}` +
      `&item_id=${encodeURIComponent(item.item_id)}` +
      `&ref=${encodeURIComponent(ref)}`;
    if (locked || reviewMode) {
      window.open(url, '_blank');
    } else {
      void saveProgress(false).then(() => window.open(url, '_blank'));
    }
  }

  const pageStart = safePage * questionsPerPage;
  const pageItems = source.slice(pageStart, pageStart + questionsPerPage);
  const grade = gradeFor(score.pct);
  const showControls = mode === 'instant' || locked || reviewMode;
  const timerPercent = totalSeconds > 0 ? secondsLeft / totalSeconds * 100 : 0;
  const timerColor = timerPercent <= 10 ? 'red' : timerPercent <= 20 ? 'amber' : '';
  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  if (startError) return <RunnerError title="Could Not Start Exam" message={startError} />;

  return (
    <div className="runner">
      {phase === 'init' || saving ? (
        <div className="qa-loader">
          <div className="loader-spinner" />
          <div className="loader-msg">{saving && saving !== 'submitting' ? saving : 'Loading your quiz…'}</div>
        </div>
      ) : null}

      {/* Sticky header */}
      <div className="runner-header" ref={headerRef}>
        <div className="header-top">
          <div className="header-brand">Quademia</div>
          <div className="header-title">{label}</div>
          <div className="header-actions">
            <button type="button" className="hbtn hbtn-ghost" onClick={openGrid}>📋 Question Grid</button>
            <button type="button" className="hbtn hbtn-danger" onClick={handleExit}>Exit</button>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-bar"><div className={barClass} style={{ width: `${locked ? 100 : pct}%` }} /></div>
          <div className="count-pill">{answered} / {items.length} answered • {unanswered} unanswered • {flaggedCount} flagged</div>
        </div>
        {mode === 'timed' && !locked && !reviewMode ? (
          <div className="timer-bar">
            <div className="timer-display" role="timer" aria-label={`${timerText} remaining`}>
              <span className="timer-icon">⏱</span>
              <span className={`timer-value ${timerColor}`}>{timerText}</span>
              <span className="timer-label">remaining</span>
            </div>
            <div className="timer-progress-wrap"><div className={`timer-progress-fill ${timerColor}`} style={{ width: `${timerPercent}%` }} /></div>
          </div>
        ) : null}
        <div className={`header-controls${showControls ? '' : ' hidden'}`}>
          <div className="control-group">
            <span className="ctrl-label">Feedback:</span>
            {(['inline', 'standalone', 'hide'] as FeedbackMode[]).map((m) => (
              <button key={m} type="button" className={`fbtn${feedbackMode === m ? ' active' : ''}`} onClick={() => changeFeedbackMode(m)}>
                {m === 'inline' ? 'Inline' : m === 'standalone' ? 'Standalone' : 'Hide'}
              </button>
            ))}
          </div>
          <div className="control-group">
            <span className="mode-pill">{W.modeWord} | {feedbackModeLabel(feedbackMode)}</span>
          </div>
        </div>
      </div>

      <div className="desktop-flex-wrap">
        <div className="runner-wrap">
          {/* Preflight card */}
          {phase === 'preflight' ? (
            <div className="preflight-card">
              <div className="preflight-logo">Quademia Nurses Hub</div>
              <div className="preflight-title">{label}</div>
              <div className="preflight-meta">
                <span className="pre-chip">{items.length} questions</span>
                <span className={`pre-chip${mode === 'timed' ? ' warning' : ''}`}>{attempt.duration_min || Math.ceil(items.length)} {mode === 'timed' ? 'minutes' : 'min suggested'}</span>
                {mode === 'instant' ? <span className="pre-chip">{feedbackModeLabel(feedbackMode)}</span> : null}
                <span className="pre-chip">{W.modeWord} Mode</span>
              </div>
              {mode === 'timed' ? (
                <div className="preflight-warning"><strong>Exam mode:</strong> The timer starts when you click Start. No feedback is shown during the exam — you will see your results and explanations after submission. You cannot pause the timer.</div>
              ) : <p className="preflight-text">{W.preflightText}</p>}
              <div className="preflight-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={onPreflightStart}>{(mode === 'timed' ? attempt.started_utc !== null : hasProgress()) ? W.resume : W.start}</button>
                <button type="button" className="btn btn-ghost" onClick={() => window.history.back()}>Cancel</button>
                <label className="preflight-skip">
                  <input type="checkbox" checked={skipNextTime} onChange={(e) => setSkipNextTime(e.target.checked)} /> Don&apos;t show this again
                </label>
              </div>
            </div>
          ) : null}

          {reviewMode ? <div className="review-banner">{W.reviewBanner}</div> : null}
          {timeUp ? <div className="timeup-banner">Time is up! Your exam has been automatically submitted.</div> : null}

          {phase === 'quiz' && desktopGridHidden ? (
            <button type="button" className="show-grid-btn" onClick={() => setDesktopGridHidden(false)}>📋 Show Grid</button>
          ) : null}

          {/* Score card */}
          {phase === 'quiz' && scoreCardOpen ? (
            <div className="score-card">
              <div className="score-grade">{grade.emoji}</div>
              <div className="score-text">{score.raw} / {score.total}</div>
              <div className="score-pct">{score.pct}%</div>
              <div className="score-label">{grade.label}</div>
              <div className="score-actions">
                <button type="button" className={`btn ${mode === 'timed' ? 'btn-primary' : 'btn-ghost'}`} onClick={reviewAnswers}>
                  {mode === 'timed' ? '📖 Review Answers & Feedback' : 'Review Answers'}
                </button>
                <button type="button" className={`btn ${mode === 'timed' ? 'btn-ghost' : 'btn-primary'}`} onClick={() => router.push(QUIZZES_PAGE)}>Back to Quizzes</button>
              </div>
            </div>
          ) : null}

          {/* Quiz card */}
          {phase === 'quiz' ? (
            <div className="quiz-card">
              <div className="q-list">
                {source.length === 0 ? (
                  <div className="q-block">
                    <div className="q-stem">No flagged questions yet.</div>
                    <div className="q-topic">{W.flaggedEmptySub}</div>
                  </div>
                ) : (
                  pageItems.map((item) => renderQuestion(item, items.indexOf(item)))
                )}
              </div>
              <div className="page-nav">
                <button type="button" className="btn btn-ghost" disabled={safePage === 0 || source.length === 0} onClick={prevPage}>← Previous</button>
                <span className="page-pill">{viewMode === 'FLAGGED' ? 'Flagged • ' : ''}Page {safePage + 1} / {totalPages}</span>
                <div className="page-nav-right">
                  <button type="button" className="btn btn-ghost" disabled={safePage >= totalPages - 1 || source.length === 0} onClick={nextPage}>Next →</button>
                  {showSubmit ? <button type="button" className="btn btn-primary btn-lg" onClick={confirmSubmit}>{W.submit}</button> : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="status-log">{status}</div>
        </div>

        {/* Desktop grid column */}
        {phase === 'quiz' ? (
          <div className={`desktop-grid-card${desktopGridHidden ? ' hidden' : ''}`}>
            <div className="dg-header">
              <div><h3>Question Grid</h3><span className="dg-score">{gridScoreText}</span></div>
              <button type="button" className="dg-hide-btn" onClick={() => setDesktopGridHidden(true)}>✕ Hide</button>
            </div>
            {gridToolbar}
            <div className="dg-grid">{gridCells()}</div>
          </div>
        ) : null}
      </div>

      {/* Floating grid button (phone) */}
      {phase === 'quiz' ? (
        <button type="button" className="fab-grid" onClick={openGrid}>📋 Question Grid</button>
      ) : null}

      <BodyPortal>
        <Toast message={toast} onDismiss={dismissToast} />
        {confirmDialog}
        <div className="runner-overlay">
          {gridOverlayOpen ? (
            <div className="overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setGridOverlayOpen(false); }}>
              <div className="grid-panel">
                <div className="grid-panel-header">
                  <div><h3>Questions</h3> <span className="grid-score">{gridScoreText}</span></div>
                  <button type="button" className="grid-close" onClick={() => setGridOverlayOpen(false)}>×</button>
                </div>
                {gridToolbar}
                <div className="grid-body">{gridCells()}</div>
              </div>
            </div>
          ) : null}

          {/* the exit choice (slice 6a), on the shared dialog since DS4; a
              choice of three stacks full-width */}
          <Dialog open={exitOpen} onClose={() => setExitOpen(false)} title={W.exitTitle}>
            <p className="dlg-text">{W.exitText}</p>
            <div className="dlg-actions stack">
              <button type="button" className="btn btn-ghost" onClick={saveAndExit}>💾 Save &amp; Resume Later</button>
              <button type="button" className="btn btn-danger" onClick={submitAndExit}>✓ Submit &amp; Exit</button>
              <button type="button" className="btn btn-ghost" onClick={() => setExitOpen(false)}>Cancel</button>
            </div>
          </Dialog>

          {imgOverlay ? (
            <div className="img-overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setImgOverlay(''); }}>
              <div className="img-overlay-inner">
                <button type="button" className="img-close" onClick={() => setImgOverlay('')}>×</button>
                {/* eslint-disable-next-line @next/next/no-img-element -- a public bucket URL */}
                <img src={imgOverlay} alt="Rationale image" />
              </div>
            </div>
          ) : null}
        </div>
      </BodyPortal>
    </div>
  );
}
