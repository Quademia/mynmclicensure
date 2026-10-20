// app/(app)/challenge/play/start-screen.tsx
//
// The challenge's own start screen (04 G2; Sam 2026-10-20: A, drawn) — not
// the card every quiz shares: "Today's challenge", the course and the day;
// the questions, the minutes and Challenge mode; its five rules, each with
// a small icon; Start, Cancel and "Don't show this again". It carries no
// question: Start asks the server for the play and its questions
// (startChallenge), the first moment they reach the browser, and the quiz
// screen mounts. The leaderboards' box comes with G1b.
//
// "Don't show this again" is remembered by the phone, for this student
// (AGENTS.md: a choice kept for a student is keyed by them), and presses
// Start by itself after that — a regular player goes from Play straight to
// the questions; the screen still shows the first time.

'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { CHALLENGE_MODE } from '@/lib/attempts/modes';
import { startChallenge } from '@/lib/challenge/actions';
import { CHALLENGE_EXIT, type ChallengeCard, type ChallengeSitting } from '@/lib/challenge/types';
import { Icon } from '@/components/shell/icons';
import { PleaseWait } from '@/components/shell/please-wait';
import { ChallengeRunner } from './challenge-client';

const RULES: { icon: Parameters<typeof Icon>[0]['name']; text: string }[] = [
  { icon: 'timer', text: 'The clock starts when you press Start and keeps running if you leave.' },
  { icon: 'pencil', text: 'Move between the questions and change your answers until you submit.' },
  { icon: 'hourglass', text: 'When the time is up, what you have answered is submitted.' },
  { icon: 'book-open', text: 'The answers and explanations show straight after, until midnight.' },
  { icon: 'calendar', text: 'One go a day.' },
];

function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function minutesWord(n: number): string {
  return `${n} minute${n === 1 ? '' : 's'}`;
}

export function ChallengeStart({ card, userId }: { card: ChallengeCard; userId: string }) {
  const router = useRouter();
  const skipKey = `${CHALLENGE_MODE.skipKey}:${userId}`;
  const skipped = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return window.localStorage.getItem(skipKey) === '1';
      } catch {
        return false;
      }
    },
    () => false,
  );

  const [sitting, setSitting] = useState<ChallengeSitting | null>(null);
  const [pending, setPending] = useState(false);
  const [skipNextTime, setSkipNextTime] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const enteringRef = useRef(false);

  async function enter() {
    if (enteringRef.current) return;
    enteringRef.current = true;
    if (skipNextTime) {
      try {
        window.localStorage.setItem(skipKey, '1');
      } catch {
        /* no storage — the screen shows next time */
      }
    }
    setPending(true);
    try {
      const r = await startChallenge();
      if (r.ok) {
        setSitting(r.sitting);
        return;
      }
      // played already (another tab): the page opens the answers
      if (/played today/i.test(r.error)) {
        router.refresh();
        return;
      }
      setToast(r.error);
    } catch {
      setToast('Could not open the challenge. Please check your connection and try again.');
    } finally {
      setPending(false);
      enteringRef.current = false;
    }
  }

  // Ticked before: the screen presses Start by itself, after the first paint.
  useEffect(() => {
    if (!skipped) return;
    const id = window.setTimeout(() => void enter(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the stored choice is read
  }, [skipped]);

  if (sitting) return <ChallengeRunner sitting={sitting} reviewMode={false} />;

  const minutesLeft = card.secondsLeft !== null ? Math.max(1, Math.ceil(card.secondsLeft / 60)) : null;
  return (
    <div className="runner session-start">
      {pending ? <PleaseWait message="Loading today's challenge…" /> : null}
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <div className="runner-wrap">
        <div className="preflight-card challenge-start">
          <div className="preflight-logo">Quademia Nurses Hub</div>
          <div className="preflight-title">Today&apos;s challenge</div>
          <div className="challenge-start-course">
            {card.courseTitle} · {card.dayLabel}
          </div>
          <div className="preflight-meta">
            <span className="pre-chip">{card.questions} questions</span>
            <span className="pre-chip warning">
              {card.resuming && minutesLeft !== null ? `${minutesLeft} min left` : minutesWord(card.minutes)}
            </span>
            <span className="pre-chip">{CHALLENGE_MODE.fullName}</span>
          </div>
          {card.resuming && minutesLeft !== null ? (
            <div className="preflight-warning">
              <strong>Your clock is still running:</strong> about {minutesWord(minutesLeft)} left.
            </div>
          ) : null}
          <ul className="challenge-rules">
            {RULES.map((r) => (
              <li key={r.icon}>
                <span className="challenge-rule-icon"><Icon name={r.icon} /></span>
                {r.text}
              </li>
            ))}
          </ul>
          <div className="preflight-actions">
            <button type="button" className="btn btn-primary btn-lg" disabled={pending} onClick={() => void enter()}>
              <Icon name="play" />
              {pending ? 'Opening…' : card.resuming ? CHALLENGE_MODE.words.resume : CHALLENGE_MODE.words.start}
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => router.push(CHALLENGE_EXIT.href)}>Cancel</button>
            <label className="preflight-skip">
              <input type="checkbox" checked={skipNextTime} onChange={(e) => setSkipNextTime(e.target.checked)} /> Don&apos;t show this again
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
