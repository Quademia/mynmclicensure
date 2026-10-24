// app/(app)/challenge/play/start-screen.tsx
//
// The challenge's own start screen (04 G2; Sam 2026-10-20: A, drawn) — not
// the card every quiz shares: "Today's challenge", the course and the day;
// the questions, the minutes and Challenge mode; its five rules, each with
// a small icon; Start, Cancel and "Don't show this again". It carries no
// question: Start asks the server for the play and its questions
// (startChallenge), the first moment they reach the browser, and the quiz
// screen mounts.
//
// "Don't show this again" is remembered by the phone, for this student
// (AGENTS.md: a choice kept for a student is keyed by them), and presses
// Start by itself after that — a regular player goes from Play straight to
// the questions; the screen still shows the first time.
//
// The leaderboards (05 G1b; Sam, 2026-10-24): a student never asked meets
// the offer first (Join → How you'll appear → this screen; Not now, just
// play → this screen), asked once. Beneath the rules, a box: to a student
// who joined, "Your time counts…" and this week's place; to one who has
// not, Join the leaderboards, straight to How you'll appear. Start presses
// itself only once the screen is this one.

'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { CHALLENGE_MODE } from '@/lib/attempts/modes';
import { startChallenge } from '@/lib/challenge/actions';
import { CHALLENGE_EXIT, type ChallengeCard, type ChallengeSitting } from '@/lib/challenge/types';
import { joinLeaderboards, notNowLeaderboards } from '@/lib/leaderboards/actions';
import { ordinal, type ShownAs, type StartLeaderboards } from '@/lib/leaderboards/types';
import { AppearPicker } from '@/components/leaderboards/appear-picker';
import { Icon } from '@/components/shell/icons';
import { PleaseWait } from '@/components/shell/please-wait';
import { ChallengeRunner } from './challenge-client';
import { JoinOffer } from './join-offer';

type Step = 'offer' | 'appear' | 'start';

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

export function ChallengeStart({
  card,
  userId,
  leaderboards,
}: {
  card: ChallengeCard;
  userId: string;
  leaderboards: StartLeaderboards;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(leaderboards.offer ? 'offer' : 'start');
  // How you'll appear opened from the offer (Cancel is then "not now") or from the box
  const [appearFrom, setAppearFrom] = useState<'offer' | 'box'>('offer');
  const [joined, setJoined] = useState(leaderboards.joined);
  const [lbPending, setLbPending] = useState<'join' | 'not-now' | null>(null);
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

  // Ticked before: the screen presses Start by itself, after the first
  // paint — once the offer, if any, has been answered.
  useEffect(() => {
    if (!skipped || step !== 'start') return;
    const id = window.setTimeout(() => void enter(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the stored choice is read or the offer answered
  }, [skipped, step]);

  // "Not now": the card is made so the offer is not asked again; a failed
  // save never holds up the play (the offer comes back next time).
  async function notNow() {
    setLbPending('not-now');
    try {
      await notNowLeaderboards();
    } catch {
      /* asked again next time */
    } finally {
      setLbPending(null);
      setStep('start');
    }
  }

  async function join(shownAs: ShownAs, word: string, animal: string) {
    setLbPending('join');
    try {
      const r = await joinLeaderboards(shownAs, word, animal);
      if (!r.ok) {
        setToast(r.error);
        return;
      }
      setJoined(true);
      setStep('start');
    } catch {
      setToast('Could not join the leaderboards. Please check your connection and try again.');
    } finally {
      setLbPending(null);
    }
  }

  if (sitting) return <ChallengeRunner sitting={sitting} reviewMode={false} />;

  if (step !== 'start') {
    return (
      <div className="runner session-start">
        <Toast message={toast} onDismiss={() => setToast(null)} />
        <div className="runner-wrap">
          {step === 'offer' ? (
            <JoinOffer
              pending={lbPending !== null}
              onJoin={() => {
                setAppearFrom('offer');
                setStep('appear');
              }}
              onNotNow={() => void notNow()}
            />
          ) : leaderboards.choices ? (
            <AppearPicker
              brand
              choices={leaderboards.choices}
              pending={lbPending !== null}
              joining={lbPending === 'join'}
              onDone={(shownAs, word, animal) => void join(shownAs, word, animal)}
              onCancel={() => (appearFrom === 'offer' ? void notNow() : setStep('start'))}
            />
          ) : null}
        </div>
      </div>
    );
  }

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
          {joined ? (
            <div className="lb-box">
              <span className="lb-box-icon" aria-hidden="true">
                <Icon name="trophy" />
              </span>
              <div>
                <div>Your time counts towards the leaderboards: right answers first, then time.</div>
                {leaderboards.weekRank?.rank ? (
                  <div className="lb-box-rank">
                    This week: {ordinal(leaderboards.weekRank.rank)} in {leaderboards.weekRank.board}
                  </div>
                ) : null}
              </div>
            </div>
          ) : leaderboards.choices ? (
            <button
              type="button"
              className="lb-box lb-box-join"
              disabled={pending}
              onClick={() => {
                setAppearFrom('box');
                setStep('appear');
              }}
            >
              <span className="lb-box-icon" aria-hidden="true">
                <Icon name="trophy" />
              </span>
              <span className="lb-box-join-text">Join the leaderboards</span>
              <span aria-hidden="true">›</span>
            </button>
          ) : null}
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
