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
// browser; autosave on the config interval and on every page turn and
// flag; the exit dialog (save and resume later, or submit and exit);
// submit with legacy's two confirm() questions; the score card; review
// mode; the admin preview path (no writes). Scores shown after submit
// are the server's (finishAttempt recomputes); before that the browser's
// own arithmetic drives the live feedback, from the same functions.
//
// Not here, by slice: "Send feedback" on each question (slice 12).
// Legacy's brand string in the header and the watermark read
// "QAcademy"; the brand is Quademia (AGENTS.md UI convention #5).

'use client';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { finishAttempt, markTimedAttemptStarted, saveAttemptProgress, saveTimedAttemptProgress } from '@/lib/attempts/actions';
import { RunnerError } from './runner-error';
import {
  buildAnswersJson,
  computeScore,
  countAnswered,
  displayLetter,
  getShuffledOptions,
  gradeFor,
  hydrateAnswers,
  type OptionView,
} from '@/lib/attempts/scoring';
import type { Attempt, AttemptMode, ChosenMap, FlagMap, Score } from '@/lib/attempts/types';
import type { Item } from '@/lib/bank/types';

type FeedbackMode = 'inline' | 'standalone' | 'hide';
type ViewMode = 'ALL' | 'FLAGGED';

const FEEDBACK_KEY = 'qa_feedback_mode';
const SKIP_KEY: Record<AttemptMode, string> = { instant: 'qa_skip_preflight', timed: 'qa_skip_preflight_timed' };
const QUIZZES_PAGE = '/student/fixed-quizzes';

const WORDS = {
  instant: {
    title: 'Practice Quiz',
    modeWord: 'Practice',
    start: '▶ Start Quiz',
    resume: '▶ Resume Attempt',
    preflightText: 'Practice mode gives you immediate feedback after each answer. You can flag questions, navigate freely and review your answers at the end.',
    reviewBanner: '📖 Review Mode — Answers are read-only. You are reviewing a completed attempt.',
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
    reviewBanner: '📖 Review Mode — Answers are read-only. You are reviewing a completed exam attempt.',
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
  questionsPerPage,
  autosaveMs,
  reviewMode,
  previewMode,
}: {
  mode: AttemptMode;
  attempt: Attempt;
  items: Item[];
  questionsPerPage: number;
  autosaveMs: number;
  reviewMode: boolean;
  previewMode: boolean;
}) {
  const router = useRouter();
  const W = WORDS[mode];
  const label = attempt.display_label || W.title;

  // ── state (legacy ANSW / FLAGS / SATA_EVAL / LOCKED / …) ──
  const hydrated = useMemo(() => hydrateAnswers(attempt.answers_json), [attempt.answers_json]);
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
  const startedAtRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const finishingRef = useRef(false);
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
            ? attempt.time_taken_s !== null
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
          ? { ok: true as const, startedIso: attempt.time_taken_s !== null && attempt.ts_iso ? attempt.ts_iso : new Date().toISOString() }
          : await markTimedAttemptStarted(attempt.attempt_id);
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
      setStatus(attempt.time_taken_s !== null
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
  const localScore = computeScore(items, answers);
  const score = serverScore ?? localScore;
  const showAlways = locked || reviewMode || finishSent;

  // ── save (legacy saveInProgress) ──
  const saveProgress = useCallback(
    async (showMsg: boolean) => {
      if (previewMode) return true;
      const records = buildAnswersJson(items, answers, flags, mode === 'instant' ? sataChecked : undefined);
      const result = mode === 'timed'
        ? await saveTimedAttemptProgress(attempt.attempt_id, records)
        : await saveAttemptProgress(attempt.attempt_id, records);
      if (showMsg) setStatus(result.ok ? W.savedLog : 'Save failed: ' + result.error);
      return result.ok;
    },
    [previewMode, items, answers, flags, sataChecked, mode, attempt.attempt_id, W.savedLog],
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

  // legacy startAutosave / autosaveTick: every AUTOSAVE_MS while running.
  useEffect(() => {
    if (!booted || locked || reviewMode || previewMode) return;
    const id = window.setInterval(() => {
      void saveProgress(false);
    }, autosaveMs);
    return () => window.clearInterval(id);
  }, [booted, locked, reviewMode, previewMode, autosaveMs, saveProgress]);

  // legacy beforeunload guard
  useEffect(() => {
    if (!booted || locked || reviewMode) return;
    const handler = (e: BeforeUnloadEvent) => {
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
  function choose(item: Item, letter: string, checked: boolean) {
    if (locked || reviewMode) return;
    if (item.question_type === 'SATA') {
      setAnswers((a) => {
        const current = Array.isArray(a[item.item_id]) ? [...(a[item.item_id] as string[])] : [];
        const next = checked ? (current.includes(letter) ? current : [...current, letter]) : current.filter((l) => l !== letter);
        const copy = { ...a };
        if (next.length) copy[item.item_id] = next;
        else delete copy[item.item_id];
        return copy;
      });
      // instant: the reveal waits for Check Answer again
      setSataChecked((s) => ({ ...s, [item.item_id]: false }));
    } else {
      setAnswers((a) => ({ ...a, [item.item_id]: letter }));
    }
  }

  function checkSata(item: Item) {
    const chosen = answers[item.item_id];
    if (!Array.isArray(chosen) || chosen.length === 0) return;
    setSataChecked((s) => ({ ...s, [item.item_id]: true }));
  }

  function toggleFlag(item: Item) {
    const next = { ...flags, [item.item_id]: !flags[item.item_id] };
    setFlags(next);
    if (!previewMode) {
      const records = buildAnswersJson(items, answers, next, mode === 'instant' ? sataChecked : undefined);
      if (mode === 'timed') void saveTimedAttemptProgress(attempt.attempt_id, records);
      else void saveAttemptProgress(attempt.attempt_id, records);
    }
  }

  // ── submit (legacy confirmSubmit / submitQuiz) ──
  function confirmSubmit() {
    if (flaggedCount > 0) {
      const goOn = window.confirm(
        `You still have ${flaggedCount} flagged question${flaggedCount !== 1 ? 's' : ''}. Click Cancel to go back and review them, or OK to continue.`,
      );
      if (!goOn) return;
    }
    if (unanswered > 0) {
      const goOn = window.confirm(`You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. Submit anyway?`);
      if (!goOn) return;
    }
    void submitQuiz();
  }

  async function submitQuiz(autoSubmit = false) {
    if (finishSent || locked || finishingRef.current) return;
    finishingRef.current = true;
    if (autoSubmit) setTimeUp(true);
    setExitOpen(false);
    setGridOverlayOpen(false);
    setFinishSent(true);
    setLocked(true);
    setSaving('submitting');

    const timeTakenS = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : null;

    if (!previewMode) {
      const records = buildAnswersJson(items, answers, flags, mode === 'instant' ? sataChecked : undefined);
      const result = await finishAttempt(attempt.attempt_id, records, timeTakenS);
      if (result.ok) setServerScore(result.score);
      else setStatus('Warning: Could not save your results. ' + result.error);
    }
    setSaving('');
    setScoreCardOpen(true);
    setStatus(autoSubmit ? 'Time is up. Your exam has been submitted automatically.' : W.submittedLog);
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
    window.location.href = QUIZZES_PAGE;
  }

  async function submitAndExit() {
    setExitOpen(false);
    await submitQuiz();
    window.setTimeout(() => {
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
          const rec = buildAnswersJson([item], answers, flags)[0];
          classes.push(rec.is_correct ? 'correct' : 'incorrect');
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

  function renderQuestion(item: Item, globalIdx: number) {
    const opts = shuffled[item.item_id] || [];
    const isSATA = item.question_type === 'SATA';
    const chosenRaw = answers[item.item_id];
    const hasAnswer = isSATA ? Array.isArray(chosenRaw) && chosenRaw.length > 0 : Boolean(chosenRaw);
    // legacy canReveal: instant reveals on answer (SATA after Check Answer); timed only when locked / review.
    const canReveal = mode === 'instant'
      ? isSATA ? showAlways || (hasAnswer && Boolean(sataChecked[item.item_id])) : showAlways || hasAnswer
      : locked || reviewMode;
    const disabled = locked || reviewMode;

    const rat = (item.rationale || '').trim();
    const imgUrl = (item.rationale_img || '').trim();
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
        {isSATA ? <div className="sata-hint">⚠️ Select ALL that apply</div> : null}

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
          </div>
          <div className="watermark">Quademia</div>
        </div>
      </div>
    );
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
                <span className="pre-chip">📝 {items.length} questions</span>
                <span className={`pre-chip${mode === 'timed' ? ' warning' : ''}`}>⏱ {attempt.duration_min || Math.ceil(items.length)} {mode === 'timed' ? 'minutes' : 'min suggested'}</span>
                {mode === 'instant' ? <span className="pre-chip">📖 {feedbackModeLabel(feedbackMode)}</span> : null}
                <span className="pre-chip">{mode === 'timed' ? '🎯 ' : ''}{W.modeWord} Mode</span>
              </div>
              {mode === 'timed' ? (
                <div className="preflight-warning">⚠️ <strong>Exam mode:</strong> The timer starts when you click Start. No feedback is shown during the exam — you will see your results and explanations after submission. You cannot pause the timer.</div>
              ) : <p className="preflight-text">{W.preflightText}</p>}
              <div className="preflight-actions">
                <button type="button" className="btn btn-primary" onClick={onPreflightStart}>{(mode === 'timed' ? attempt.time_taken_s !== null : hasProgress()) ? W.resume : W.start}</button>
                <button type="button" className="btn btn-ghost" onClick={() => window.history.back()}>Cancel</button>
                <label className="preflight-skip">
                  <input type="checkbox" checked={skipNextTime} onChange={(e) => setSkipNextTime(e.target.checked)} /> Don&apos;t show this again
                </label>
              </div>
            </div>
          ) : null}

          {reviewMode ? <div className="review-banner">{W.reviewBanner}</div> : null}
          {timeUp ? <div className="timeup-banner">⏰ Time is up! Your exam has been automatically submitted.</div> : null}

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
                  {showSubmit ? <button type="button" className="btn btn-primary" onClick={confirmSubmit}>{W.submit}</button> : null}
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

          {exitOpen ? (
            <div className="overlay-backdrop">
              <div className="exit-panel">
                <h3>{W.exitTitle}</h3>
                <p>{W.exitText}</p>
                <div className="exit-actions">
                  <button type="button" className="btn btn-ghost" onClick={saveAndExit}>💾 Save &amp; Resume Later</button>
                  <button type="button" className="btn btn-danger" onClick={submitAndExit}>✓ Submit &amp; Exit</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setExitOpen(false)}>Cancel</button>
                </div>
              </div>
            </div>
          ) : null}

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
