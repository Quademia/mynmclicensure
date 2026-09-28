// components/runner/quiz-runner.tsx
//
// The runner core — the script block of legacy runner/instant.html and
// runner/timed.html, which were one script with two modes (slice 6a
// built the core and the instant mode; 6b the timed pieces).
//
// Since 03 Q8 (Sam, 2026-09-27) it is a player: one page,
// `/session/<id>`, and the attempt says its mode. The runner reads the
// mode's row in lib/attempts/modes — is there a clock, does feedback show
// after each question or at the end — and its words from there, instead
// of asking "instant or timed?" in two dozen places; Exit goes to the
// sitting's home, which the page resolves (lib/attempts/links). Since Q9
// the option being checked shows it until the server's reply lands.
//
// What it does, in legacy's order (the preflight card is its own screen
// since 03 Q17, session-start.tsx, and the runner mounts after it): pages of N questions
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
import { advanceAttempt, checkAnswer, expireAttempt, finishAttempt, retakeAttempt, saveAnswers } from '@/lib/attempts/actions';
import { sessionHref } from '@/lib/attempts/links';
import { ResultsPopup, type ResultsSummary } from './results-popup';
import { Icon } from '@/components/shell/icons';
import { KindChip, QUESTION_TYPE_HUE } from '@/components/shell/chips';
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
import type { SessionExit } from '@/lib/attempts/links';
import { modeOf } from '@/lib/attempts/modes';
import type { AnswerPatch, Attempt, ChosenMap, FlagMap, Score, SealedItem, SecretsMap } from '@/lib/attempts/types';

type FeedbackMode = 'inline' | 'standalone' | 'hide';
type ViewMode = 'ALL' | 'FLAGGED';

const FEEDBACK_KEY = 'qa_feedback_mode';
/** A question's save lands this long after the last tap on it. */
const SAVE_DEBOUNCE_MS = 500;
/** The timed auto-submit, when it fails, tries again after this long. */
const AUTO_SUBMIT_RETRY_MS = 10_000;

function feedbackModeLabel(m: FeedbackMode): string {
  if (m === 'standalone') return 'Standalone feedback';
  if (m === 'hide') return 'Hide explanations';
  return 'Inline feedback';
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
}

export function QuizRunner({
  attempt,
  items,
  secrets: initialSecrets,
  questionsPerPage,
  reviewMode,
  previewMode,
  exit,
  retakeAllowed = false,
}: {
  attempt: Attempt;
  items: SealedItem[];
  secrets: SecretsMap;
  questionsPerPage: number;
  reviewMode: boolean;
  previewMode: boolean;
  /** Where Exit and the buttons after submitting go: the sitting's home. */
  exit: SessionExit;
  /** 03 Q18: the results pop-up offers Retake (the server checks again on the press). */
  retakeAllowed?: boolean;
}) {
  const router = useRouter();
  // The mode's row (03 Q8): the runner asks it, never the code.
  const M = modeOf(attempt.mode);
  const W = M.words;
  const hasClock = M.clock !== 'none';
  const feedbackEach = M.feedback === 'each';
  // Sequential (§8 S21, Q8 step 3): while the sitting is live, one
  // question at a time, forward only — the database holds the order
  // (advance_attempt, and save_answers taking only the current row).
  // A finished sitting's review moves freely, as every other review.
  const forwardOnly = M.nav === 'forward';
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
  // Since 03 Q17 the start card is its own screen (session-start.tsx):
  // the runner mounts on a started sitting and goes straight to the quiz.
  const [phase, setPhase] = useState<'init' | 'quiz'>('init');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('ALL');
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('inline');
  // 03 Q18: the results pop-up — opened by the finish, and by the
  // header's score pill; not on reopening a finished sitting.
  const [resultsOpen, setResultsOpen] = useState(false);
  const [serverTime, setServerTime] = useState<number | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [serverScore, setServerScore] = useState<Score | null>(null);
  const [gridOverlayOpen, setGridOverlayOpen] = useState(false);
  const [desktopGridHidden, setDesktopGridHidden] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [imgOverlay, setImgOverlay] = useState('');
  const [saving, setSaving] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  // 03 Q9: the questions whose Check Answer is on its way to the server.
  const [checking, setChecking] = useState<FlagMap>({});
  // Sequential: the questions the student has moved past (the rows'
  // passed_utc, then each move), and a move on its way to the server.
  const [passed, setPassed] = useState<FlagMap>(() =>
    Object.fromEntries(items.filter((i) => i.passed_utc).map((i) => [i.item_id, true])),
  );
  const [advancing, setAdvancing] = useState(false);
  const dismissToast = useCallback(() => setToast(null), []);
  const startedAtRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const lastAutoSubmitRef = useRef(0);
  // The save queue (03 Q5): one pending patch per question, flushed half
  // a second after the last tap, or at once by a flag or a page turn.
  const pendingRef = useRef<Map<string, AnswerPatch>>(new Map());
  const flushTimerRef = useRef<number | null>(null);
  const totalSeconds = (attempt.duration_min || items.length) * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [timeUp, setTimeUp] = useState(false);
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

      // A finished sitting reopened: the review, with no pop-up (the pill
      // opens it) and, since Q18, no question map over it on a phone.
      if (reviewMode) {
        setPhase('quiz');
        setBooted(true);
        return;
      }

      startQuiz();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount
  }, []);

  function hasAnswerFor(item: SealedItem): boolean {
    const c = answers[item.item_id];
    return item.question_type === 'SATA' ? Array.isArray(c) && c.length > 0 : Boolean(c);
  }

  // Since 03 Q17 the sitting arrives started: the start card's press
  // stamped an exam's clock on the server before the questions came, so
  // the countdown runs from that stamp (the admin's preview, which stamps
  // nothing, from now).
  function startQuiz() {
    if (booted) return;
    startedAtRef.current = hasClock && attempt.started_utc ? new Date(attempt.started_utc).getTime() : Date.now();
    if (hasClock) setSecondsLeft(Math.max(0, totalSeconds - Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))));
    setBooted(true);
    setPhase('quiz');
    setPage(0);
    setViewMode('ALL');
  }

  // ── derived (legacy getCurrentSource / getGridStats / paging) ──
  // Sequential while live: one question a page, and the page is the first
  // question not yet passed — the student cannot choose another.
  const liveForward = forwardOnly && !locked && !reviewMode;
  const perPage = liveForward ? 1 : questionsPerPage;
  const firstOpen = items.findIndex((i) => !passed[i.item_id]);
  const currentIdx = firstOpen < 0 ? Math.max(0, items.length - 1) : firstOpen;
  const source = viewMode === 'FLAGGED' ? items.filter((i) => flags[i.item_id]) : items;
  const totalPages = Math.max(1, Math.ceil(Math.max(source.length, 1) / perPage));
  const safePage = liveForward ? currentIdx : Math.max(0, Math.min(page, totalPages - 1));
  const allPageCount = Math.max(1, Math.ceil(items.length / perPage));
  const answered = countAnswered(items, answers);
  const flaggedCount = items.filter((i) => flags[i.item_id]).length;
  const unanswered = Math.max(0, items.length - answered);
  const pct = items.length > 0 ? Math.round((answered / items.length) * 100) : 0;
  const showSubmit = !locked && !reviewMode && viewMode === 'ALL' && safePage >= allPageCount - 1;
  // Sequential: the question on screen, and whether it has an answer — a
  // move (and the last question's Submit) needs one (Sam, 2026-09-27).
  const currentItem = items[currentIdx];
  const currentAnswered = currentItem ? hasAnswerFor(currentItem) : false;
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

  // The pending saves, flushed now (a page turn, Save & Resume Later,
  // Send feedback). Legacy's status line said "Progress saved" when asked;
  // that line went with legacy's status log (Sam, 2026-09-27).
  const saveProgress = useCallback(() => flushSaves(), [flushSaves]);

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
    if (!hasClock || !booted || locked || reviewMode) return;
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
  }, [hasClock, booted, locked, reviewMode]);

  // legacy beforeunload guard — for a closed tab or a typed address, not
  // for our own exit. Save & Resume Later and Submit & Exit left by a
  // full load until 2026-09-28, which used to trip this guard too, so a
  // student who had just saved was told their changes may not be saved
  // (legacy did the same; fixed with DS4, Sam 2026-09-22). They move
  // inside the app now, so the loading placeholder shows on the way out
  // (Sam, 2026-09-28); the ref is still set in the exit handlers before
  // they navigate.
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
      void saveProgress();
      gotoPage(safePage - 1);
    }
  }

  function nextPage() {
    if (safePage < totalPages - 1) {
      void saveProgress();
      gotoPage(safePage + 1);
    }
  }

  function changeViewMode(m: ViewMode) {
    setViewMode(m);
    setPage(0);
  }

  // Sequential's move (§8 S21): the answer saved first — the server
  // moves on only from a question with an answer — then the server stamps
  // the question passed and the next one comes up. A refusal (no answer,
  // time up, a dropped connection) is a toast and the question stays.
  async function advanceSequential() {
    if (!currentItem || !currentAnswered || advancing) return;
    setAdvancing(true);
    try {
      if (!previewMode) {
        if (!(await flushSaves())) {
          setToast('Could not save your answer. Please check your connection and try again.');
          return;
        }
        const r = await advanceAttempt(attempt.attempt_id);
        if (!r.ok) {
          setToast(r.error);
          return;
        }
      }
      setPassed((p) => ({ ...p, [currentItem.item_id]: true }));
      scrollToTop();
    } catch {
      setToast('Could not move to the next question. Please check your connection and try again.');
    } finally {
      setAdvancing(false);
    }
  }

  // ── answering ──
  function setCheckingFor(itemId: string, on: boolean) {
    setChecking((c) => {
      const copy = { ...c };
      if (on) copy[itemId] = true;
      else delete copy[itemId];
      return copy;
    });
  }

  function choose(item: SealedItem, letter: string, checked: boolean) {
    if (locked || reviewMode || checking[item.item_id]) return;
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
    if (feedbackEach && !previewMode) {
      // The pick is the check for an MCQ / TF (legacy revealed on answer):
      // the server writes and grades the row and returns its secret half,
      // which is what reveals the feedback (Q6). A failure falls back to
      // the plain save so the answer still lands, and says so. Until the
      // reply lands the option says it is being checked, and the question
      // takes no second pick (Q9).
      setCheckingFor(item.item_id, true);
      void checkAnswer(item.attempt_item_id, letter)
        .then((r) => {
          if (r.ok) setSecrets((s) => ({ ...s, [item.item_id]: r.secret }));
          else {
            queueSave({ item_id: item.item_id, chosen: letter });
            setToast(`Could not check this answer: ${r.error}`);
          }
        })
        .catch(() => {
          queueSave({ item_id: item.item_id, chosen: letter });
          setToast('Could not check this answer. Please check your connection.');
        })
        .finally(() => setCheckingFor(item.item_id, false));
    } else {
      queueSave({ item_id: item.item_id, chosen: letter });
    }
  }

  function checkSata(item: SealedItem) {
    const chosen = answers[item.item_id];
    if (!Array.isArray(chosen) || chosen.length === 0 || checking[item.item_id]) return;
    setSataChecked((s) => ({ ...s, [item.item_id]: true }));
    if (previewMode) return;
    // The check writes the answer itself; a pending save for this row
    // would only overwrite sata_checked with false.
    pendingRef.current.delete(item.item_id);
    setCheckingFor(item.item_id, true);
    void checkAnswer(item.attempt_item_id, chosen, true)
      .then((r) => {
        if (r.ok) setSecrets((s) => ({ ...s, [item.item_id]: r.secret }));
        else {
          queueSave({ item_id: item.item_id, chosen: chosenToStored(chosen), sata_checked: true });
          setToast(`Could not check this answer: ${r.error}`);
        }
      })
      .catch(() => {
        queueSave({ item_id: item.item_id, chosen: chosenToStored(chosen), sata_checked: true });
        setToast('Could not check this answer. Please check your connection.');
      })
      .finally(() => setCheckingFor(item.item_id, false));
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
  async function submitQuiz(autoSubmit = false, openResults = true): Promise<boolean> {
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
        return false;
      }
      setServerScore(result.score);
      setServerTime(result.timeTakenS);
      // The sitting is over: every question's secret half arrives with
      // the score, so the review renders without a reload (Q6).
      setSecrets((s) => ({ ...s, ...result.secrets }));
    } else {
      setServerTime(timeTakenS);
    }
    if (autoSubmit) setTimeUp(true);
    setFinishSent(true);
    setLocked(true);
    setSaving('');
    // Q18: the results pop-up opens over the review — not on Submit &
    // Exit, which leaves the page a moment later.
    if (openResults) setResultsOpen(true);
    return true;
  }

  function reviewAnswers() {
    setResultsOpen(false);
    setViewMode('ALL');
    setPage(0);
    // the top of the page, so question 1 opens below the header, not under it
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Q18's Retake: the same action the quiz lists and Learning History
  // use (the origin's quiz open, the mode allowed — checked again there),
  // then the new sitting's start card.
  async function retakeNow() {
    if (retaking) return;
    setRetaking(true);
    try {
      const r = await retakeAttempt(attempt.attempt_id);
      if (!r.ok) {
        setToast(r.error || 'Could not start the retake. Please try again.');
        return;
      }
      leavingRef.current = true;
      router.push(sessionHref(r.attemptId));
    } catch {
      setToast('Could not start the retake. Please check your connection and try again.');
    } finally {
      setRetaking(false);
    }
  }

  // ── exit (legacy handleExit / saveAndExit / submitAndExit) ──
  // To the sitting's home (03 Q8), where legacy always went to Fixed Quizzes.
  function handleExit() {
    // the way out's placeholder fetched while the student chooses, so it
    // shows at once on a production build (2026-09-28)
    router.prefetch(exit.href);
    if (locked || reviewMode) {
      router.push(exit.href);
      return;
    }
    setExitOpen(true);
  }

  async function saveAndExit() {
    setSaving('Saving your progress…');
    await saveProgress();
    // the loader stays up until the next page takes over — cleared here,
    // the quiz sat on screen with no sign of the move (walked 2026-09-28)
    leavingRef.current = true;
    router.push(exit.href);
  }

  async function submitAndExit() {
    setExitOpen(false);
    const done = await submitQuiz(false, false);
    if (!done) return;
    // Legacy paused 1.5 s here to show its score card; since Q18 that card
    // is the pop-up, which Submit & Exit does not open, so the pause
    // showed nothing. The way out is at once, the loader up with legacy's
    // "Quiz submitted." until the next page takes over (2026-09-28).
    setSaving('Quiz submitted.');
    leavingRef.current = true;
    router.push(exit.href);
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
      if (Math.floor(srcIdx / perPage) === safePage) classes.push('current');
      return (
        <button
          key={item.item_id}
          type="button"
          className={classes.join(' ')}
          // Sequential while live: the map shows progress, it does not move
          disabled={liveForward}
          onClick={() => {
            if (liveForward) return;
            gotoPage(Math.floor(srcIdx / perPage));
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
      {/* Sequential while live has nothing to come back to, so no flags */}
      {liveForward ? null : (
        <div className="grid-toggles">
          <button type="button" className={`grid-toggle${viewMode === 'ALL' ? ' active' : ''}`} onClick={() => changeViewMode('ALL')}>All</button>
          <button type="button" className={`grid-toggle${viewMode === 'FLAGGED' ? ' active' : ''}`} onClick={() => changeViewMode('FLAGGED')}>Flagged ({flaggedCount})</button>
        </div>
      )}
      <div className="grid-stats">
        <span className="grid-stat">{answered} answered</span>
        <span className="grid-stat">{unanswered} unanswered</span>
        {liveForward ? null : <span className="grid-stat">{flaggedCount} flagged</span>}
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
    // legacy canReveal: feedback after each question reveals on answer
    // (SATA after Check Answer); feedback at the end only when locked /
    // review — and, since Q6, only once the secret half is here: without
    // it there is nothing to reveal.
    const wantsReveal = feedbackEach
      ? isSATA ? showAlways || (hasAnswer && Boolean(sataChecked[item.item_id])) : showAlways || hasAnswer
      : locked || reviewMode;
    const canReveal = wantsReveal && secret !== null;
    const isChecking = Boolean(checking[item.item_id]);
    const disabled = locked || reviewMode;
    // the options, not the flag, wait for a check in flight (Q9)
    const optionsOff = disabled || isChecking;

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
          <KindChip hue={QUESTION_TYPE_HUE[item.question_type]}>{item.question_type}</KindChip>
          {item.maintopic ? <span className="q-topic">{item.maintopic}{item.subtopic ? ` › ${item.subtopic}` : ''}</span> : null}
          {flags[item.item_id] ? <span className="q-flag-indicator"><Icon name="flag" /></span> : null}
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
            } else if (isChecking && isChosen) {
              classes.push('checking');
            } else if (!feedbackEach && isChosen) {
              classes.push('selected');
            }
            if (optionsOff) classes.push('disabled');
            return (
              <label key={opt.letter} className={classes.join(' ')}>
                <div className="opt-row">
                  <input
                    className="opt-input"
                    type={isSATA ? 'checkbox' : 'radio'}
                    name={`opt_${item.item_id}`}
                    value={opt.letter}
                    disabled={optionsOff}
                    checked={isChosen}
                    onChange={(e) => choose(item, opt.letter, e.target.checked)}
                  />
                  <div className="opt-body">
                    <div className="opt-title">
                      <span className="opt-text"><strong>{displayLetter(j, opt.letter)}.</strong> {opt.text}</span>
                      {!canReveal && isChecking && isChosen ? <span className="badge badge-checking" role="status">Checking…</span> : null}
                      {canReveal && opt.isCorrect ? <span className="badge badge-correct">✓ Correct answer</span> : null}
                      {canReveal && isChosen && !opt.isCorrect ? <span className="badge badge-wrong">✗ Your choice</span> : null}
                      {canReveal && isChosen && opt.isCorrect ? <span className="badge badge-chosen">✓ Your choice</span> : null}
                    </div>
                    {canReveal && feedbackMode === 'inline' && opt.fb ? <div className="opt-fb">{opt.fb}</div> : null}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {feedbackEach && isSATA && !locked && !reviewMode ? (
          <div className="sata-check-row">
            <button type="button" className="btn btn-primary" disabled={!hasAnswer || Boolean(sataChecked[item.item_id]) || isChecking} onClick={() => checkSata(item)}>
              {isChecking ? 'Checking…' : sataChecked[item.item_id] ? '✓ Answer checked' : 'Check Answer'}
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
            {liveForward ? null : (
              <button type="button" className={`btn btn-flag${flags[item.item_id] ? ' flagged' : ''}`} disabled={disabled} onClick={() => toggleFlag(item)}>
                <Icon name="flag" />{flags[item.item_id] ? 'Unflag' : 'Flag'}
              </button>
            )}
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
    lines.push(`Quademia — Question feedback (${M.fullName})`);
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
      void saveProgress().then(() => window.open(url, '_blank'));
    }
  }

  const pageStart = safePage * perPage;
  const pageItems = source.slice(pageStart, pageStart + perPage);
  const grade = gradeFor(score.pct);
  const showControls = feedbackEach || locked || reviewMode;
  // Q18's summary: the questions right, wrong and not answered, by the
  // grid's own test (the server's grade, or the key once it is here).
  const finished = locked || reviewMode;
  const tally = { correct: 0, wrong: 0, unanswered: 0 };
  if (finished) {
    for (const item of items) {
      if (!hasAnswerFor(item)) {
        tally.unanswered++;
        continue;
      }
      const secret = secrets[item.item_id];
      const right = secret ? isCorrectAnswer(item.question_type, secret.correct, answers[item.item_id]) : item.is_correct === true;
      if (right) tally.correct++;
      else tally.wrong++;
    }
  }
  const results: ResultsSummary = {
    heading: timeUp ? 'Time is up' : M.group === 'study' ? 'Quiz complete' : 'Exam complete',
    emoji: grade.emoji,
    gradeLabel: grade.label,
    pct: score.pct,
    ...tally,
    total: items.length,
    timeTakenS: serverTime ?? attempt.time_taken_s,
    modeName: M.fullName,
  };
  const timerPercent = totalSeconds > 0 ? secondsLeft / totalSeconds * 100 : 0;
  const timerColor = timerPercent <= 10 ? 'red' : timerPercent <= 20 ? 'amber' : '';
  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;


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
            {/* Q18: a finished sitting's score, opening the results pop-up again */}
            {finished && phase === 'quiz' ? (
              <button type="button" className="hbtn hbtn-ghost hbtn-score" onClick={() => setResultsOpen(true)} aria-label={`Your results: ${score.raw} of ${score.total}, ${score.pct} percent`}>
                {score.raw} / {score.total} · {score.pct}%
              </button>
            ) : null}
            <button type="button" className="hbtn hbtn-ghost" onClick={openGrid}><Icon name="grid" />Question Grid</button>
            <button type="button" className="hbtn hbtn-danger" onClick={handleExit}>Exit</button>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-bar"><div className={barClass} style={{ width: `${locked ? 100 : pct}%` }} /></div>
          <div className="count-pill">{answered} / {items.length} answered • {unanswered} unanswered{liveForward ? '' : ` • ${flaggedCount} flagged`}</div>
        </div>
        {hasClock && !locked && !reviewMode ? (
          <div className="timer-bar">
            <div className="timer-display" role="timer" aria-label={`${timerText} remaining`}>
              <span className="timer-icon"><Icon name="timer" /></span>
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
            <span className="mode-pill">{M.fullName} | {feedbackModeLabel(feedbackMode)}</span>
          </div>
        </div>
      </div>

      <div className="desktop-flex-wrap">
        <div className="runner-wrap">
          {reviewMode ?<div className="review-banner">{W.reviewBanner}</div> : null}
          {timeUp ? <div className="timeup-banner">Time is up! Your exam has been automatically submitted.</div> : null}

          {phase === 'quiz' && desktopGridHidden ? (
            <button type="button" className="show-grid-btn" onClick={() => setDesktopGridHidden(false)}><Icon name="grid" />Show Grid</button>
          ) : null}

          {/* Quiz card (Q18: legacy's inline score card is the results pop-up now) */}
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
              {liveForward ? (
                // Sequential: no way back; the move and the last Submit need an answer
                <div className="page-nav">
                  <span className="page-pill">Question {currentIdx + 1} / {items.length}</span>
                  <div className="page-nav-right">
                    {showSubmit ? (
                      <button type="button" className="btn btn-primary btn-lg" disabled={!currentAnswered} onClick={confirmSubmit}>{W.submit}</button>
                    ) : (
                      <button type="button" className="btn btn-primary" disabled={!currentAnswered || advancing} onClick={advanceSequential}>
                        {advancing ? 'Saving…' : 'Next question →'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="page-nav">
                  <button type="button" className="btn btn-ghost" disabled={safePage === 0 || source.length === 0} onClick={prevPage}>← Previous</button>
                  <span className="page-pill">{viewMode === 'FLAGGED' ? 'Flagged • ' : ''}Page {safePage + 1} / {totalPages}</span>
                  <div className="page-nav-right">
                    <button type="button" className="btn btn-ghost" disabled={safePage >= totalPages - 1 || source.length === 0} onClick={nextPage}>Next →</button>
                    {showSubmit ? <button type="button" className="btn btn-primary btn-lg" onClick={confirmSubmit}>{W.submit}</button> : null}
                  </div>
                </div>
              )}
              {liveForward && !currentAnswered ? <div className="sata-check-note">Answer this question to move on. You cannot come back to it.</div> : null}
            </div>
          ) : null}
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
        <button type="button" className="fab-grid" onClick={openGrid}><Icon name="grid" />Question Grid</button>
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

          {/* Q18: the results, once the sitting is finished */}
          <ResultsPopup
            open={resultsOpen && finished}
            summary={results}
            onReview={reviewAnswers}
            onClose={() => setResultsOpen(false)}
            retake={retakeAllowed && !previewMode ? { onClick: () => void retakeNow(), pending: retaking } : null}
            exit={{ label: exit.label, onClick: () => { leavingRef.current = true; router.push(exit.href); } }}
          />

          {/* the exit choice (slice 6a), on the shared dialog since DS4; a
              choice of three stacks full-width */}
          <Dialog open={exitOpen} onClose={() => setExitOpen(false)} title={W.exitTitle}>
            <p className="dlg-text">{W.exitText}</p>
            <div className="dlg-actions stack">
              <button type="button" className="btn btn-ghost" onClick={saveAndExit}><Icon name="save" />Save &amp; Resume Later</button>
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
