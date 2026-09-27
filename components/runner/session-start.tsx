// components/runner/session-start.tsx
//
// The start card, on a page of its own (03 Q17, Sam 2026-09-27). Before
// Q17 the card sat inside the runner, so the runner's header showed
// behind it — the question map, Exit, the progress bar and an exam's
// clock — and every question was already in the page. Now the session
// page hands this component the card's data only (lib/attempts/
// runner-load: title, mode, count, minutes, Start or Resume); Start or
// Resume asks the server for the questions (enterSession), which starts
// an exam's clock first, and only then does the runner mount. MyNclex's
// start screen has its own page too, but still sends the questions with
// it (its session page, read 2026-09-27).
//
// The card shows on every open — Start the first time, Resume after
// (Sam: Option 2). "Don't show this again" is remembered per mode in the
// browser (legacy's keys) and, when set, presses the button by itself
// (Sam: every mode — it means "I understand this now"). A way to undo it
// waits for a settings page.

'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { enterSession } from '@/lib/attempts/actions';
import type { SessionExit } from '@/lib/attempts/links';
import { modeOf, preflightBrief } from '@/lib/attempts/modes';
import type { SessionPlay, StartCard } from '@/lib/attempts/runner-load';
import { Icon } from '@/components/shell/icons';
import { QuizRunner } from './quiz-runner';
import { RunnerError } from './runner-error';

function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function SessionStart({ card, exit, previewMode }: { card: StartCard; exit: SessionExit; previewMode: boolean }) {
  const router = useRouter();
  const M = modeOf(card.mode);
  const W = M.words;
  const clocked = M.clock !== 'none';

  // The mode's "Don't show this again", read from the browser the way
  // AGENTS.md asks (no read in render, no effect setting state).
  const skipped = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return window.localStorage.getItem(M.skipKey) === '1';
      } catch {
        return false;
      }
    },
    () => false,
  );

  const [play, setPlay] = useState<SessionPlay | null>(null);
  const [failure, setFailure] = useState<{ title: string; message: string; exit: SessionExit } | null>(null);
  const [pending, setPending] = useState(false);
  const [skipNextTime, setSkipNextTime] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const enteringRef = useRef(false);

  async function enter() {
    if (enteringRef.current) return;
    enteringRef.current = true;
    if (skipNextTime) {
      try {
        window.localStorage.setItem(M.skipKey, '1');
      } catch {
        /* no storage — the card shows next time */
      }
    }
    setPending(true);
    try {
      const r = await enterSession(card.attemptId, previewMode);
      if (r.kind === 'play') {
        setPlay(r);
        return;
      }
      // finished in another tab, or its time ran out on the card
      if (r.kind === 'review') {
        router.refresh();
        return;
      }
      setFailure(r);
    } catch {
      setToast('Could not open this quiz. Please check your connection and try again.');
    } finally {
      setPending(false);
      enteringRef.current = false;
    }
  }

  // Ticked before: the card presses its own button, after the first paint.
  useEffect(() => {
    if (!skipped) return;
    const id = window.setTimeout(() => void enter(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the stored choice is read
  }, [skipped]);

  if (failure) return <RunnerError title={failure.title} message={failure.message} exit={failure.exit} />;
  if (play) {
    return (
      <QuizRunner
        attempt={play.attempt}
        items={play.items}
        secrets={play.secrets}
        questionsPerPage={play.questionsPerPage}
        reviewMode={false}
        previewMode={previewMode}
        exit={exit}
        retakeAllowed={play.retakeAllowed}
      />
    );
  }

  const title = card.displayLabel || W.title;
  const minutesLeft = card.secondsLeft !== null ? Math.max(1, Math.ceil(card.secondsLeft / 60)) : null;
  const brief = clocked && card.resuming && minutesLeft !== null
    ? `${M.brief} The clock is still running: about ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'} left.`
    : preflightBrief(M, card.durationMin);
  const buttonWord = pending ? (clocked && !card.resuming ? W.starting : 'Opening…') : card.resuming ? W.resume : W.start;

  return (
    <div className="runner session-start">
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <div className="runner-wrap">
        <div className="preflight-card">
          <div className="preflight-logo">Quademia Nurses Hub</div>
          <div className="preflight-title">{title}</div>
          <div className="preflight-meta">
            <span className="pre-chip">{card.count} questions</span>
            {clocked ? (
              <span className="pre-chip warning">
                {card.resuming && minutesLeft !== null ? `${minutesLeft} min left` : `${card.durationMin || card.count} minutes`}
              </span>
            ) : (
              <span className="pre-chip">{card.durationMin || card.count} min suggested</span>
            )}
            <span className="pre-chip">{M.fullName}</span>
          </div>
          {clocked ? (
            <div className="preflight-warning"><strong>{M.fullName}:</strong> {brief}</div>
          ) : (
            <p className="preflight-text">{brief}</p>
          )}
          <div className="preflight-actions">
            <button type="button" className="btn btn-primary btn-lg" disabled={pending} onClick={() => void enter()}>
              <Icon name={clocked ? 'target' : 'play'} />
              {buttonWord}
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => router.push(exit.href)}>Cancel</button>
            <label className="preflight-skip">
              <input type="checkbox" checked={skipNextTime} onChange={(e) => setSkipNextTime(e.target.checked)} /> Don&apos;t show this again
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
