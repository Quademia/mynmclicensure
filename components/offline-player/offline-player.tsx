// components/offline-player/offline-player.tsx — the offline player (07.4;
// Sam, 2026-10-15: B, a small player of its own, built from the runner's
// pieces, not the runner — real sittings stay untouched).
//
// It plays a pack's questions with no server: the pack carries each
// question's answer by design, so it marks itself, by the database's own
// rule (isCorrectAnswer, lib/attempts/scoring — the same as grade_answer()).
// Two ways, asked on the pack's page: Answer as you go (an MCQ or True /
// False answer shows at once; a select-all one on Check) and Answers at the
// end (the score, then each answer). Right or wrong and the correct answer
// only — no explanation in a pack (Sam). Nothing goes back to the server
// (Sam: no sync). Letters stay as stored, so the player and the PDF's
// answer page agree.
//
// The look is the runner's own (styles/runner.css: the navy header, the
// question card, the option rows and their badges) plus what a pack's end
// screen adds (styles/offline-player.css). In 07.3 the same component runs
// from the phone's copy of the pack, with no signal.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLink, LinkPending } from '@/components/shell/link-pending';
import { isCorrectAnswer } from '@/lib/attempts/scoring';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

export type PlayerWay = 'go' | 'end';

export type PlayerItem = {
  id: string;
  question_type: string;
  stem: string;
  options: { letter: string; text: string }[];
  correct: string;
  topic: string | null;
};

type Chosen = Record<string, string | string[]>;

const TYPE_LABEL: Record<string, string> = { MCQ: 'MCQ', SATA: 'Select all', TF: 'True / False' };

function hasAnswer(item: PlayerItem, v: string | string[] | undefined): boolean {
  return item.question_type === 'SATA' ? Array.isArray(v) && v.length > 0 : typeof v === 'string' && v.length > 0;
}

function correctLetters(item: PlayerItem): string[] {
  return String(item.correct || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "B" or "A, C, E" — the answer as the PDF's answer page prints it. */
function answerWords(item: PlayerItem): string {
  return correctLetters(item)
    .map((l) => l.toUpperCase())
    .join(', ');
}

function chosenWords(v: string | string[] | undefined): string {
  const letters = Array.isArray(v) ? v : v ? [v] : [];
  return [...letters]
    .sort()
    .map((l) => l.toUpperCase())
    .join(', ');
}

export function OfflinePlayer({
  title,
  items,
  way,
  exitHref,
}: {
  title: string;
  items: PlayerItem[];
  way: PlayerWay;
  /** The pack's own page. */
  exitHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<Chosen>({});
  // Answer as you go: the questions whose answer is showing
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  // the end screen's question opened from its list; null = the list
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const router = useRouter();

  const total = items.length;
  const answeredCount = items.filter((it) => hasAnswer(it, chosen[it.id])).length;
  const marks = useMemo(
    () => items.map((it) => (hasAnswer(it, chosen[it.id]) ? (isCorrectAnswer(it.question_type, it.correct, chosen[it.id]) ? 'right' : 'wrong') : 'blank')),
    [items, chosen],
  );
  const right = marks.filter((m) => m === 'right').length;
  const blank = marks.filter((m) => m === 'blank').length;
  const pct = total ? Math.round((right / total) * 100) : 0;

  function pick(item: PlayerItem, letter: string, on: boolean) {
    if (finished || shown[item.id]) return;
    if (item.question_type === 'SATA') {
      setChosen((c) => {
        const now = Array.isArray(c[item.id]) ? (c[item.id] as string[]) : [];
        return { ...c, [item.id]: on ? [...new Set([...now, letter])] : now.filter((x) => x !== letter) };
      });
      return;
    }
    setChosen((c) => ({ ...c, [item.id]: letter }));
    if (way === 'go') setShown((s) => ({ ...s, [item.id]: true }));
  }

  function checkSata(item: PlayerItem) {
    if (hasAnswer(item, chosen[item.id])) setShown((s) => ({ ...s, [item.id]: true }));
  }

  function finish() {
    setFinished(true);
    setReviewing(null);
    window.scrollTo({ top: 0 });
  }

  function again() {
    setChosen({});
    setShown({});
    setIndex(0);
    setFinished(false);
    setReviewing(null);
    window.scrollTo({ top: 0 });
  }

  function go(i: number) {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    window.scrollTo({ top: 0 });
  }

  async function leave(e: React.MouseEvent) {
    if (finished || answeredCount === 0) return;
    e.preventDefault();
    const ok = await confirm({
      title: 'Leave this practice?',
      body: 'Your answers here will not be kept.',
      confirmLabel: 'Leave',
      cancelLabel: 'Keep practising',
    });
    if (ok) router.push(exitHref);
  }

  /** One question's card: live, or revealed (as you go after an answer; every question after the end). */
  function question(item: PlayerItem, at: number, reveal: boolean) {
    const value = chosen[item.id];
    const isSata = item.question_type === 'SATA';
    const keys = correctLetters(item);
    const mark = marks[at];
    return (
      <div className="q-block">
        <div className="q-meta">
          <span className="q-num">
            Q{at + 1} / {total}
          </span>
          <span className="badge badge-neutral">{TYPE_LABEL[item.question_type] || item.question_type}</span>
          {item.topic ? <span className="q-topic">{item.topic}</span> : null}
        </div>
        <div className="q-stem">{item.stem}</div>
        <div className="opts">
          {item.options.map((opt) => {
            const isChosen = isSata ? Array.isArray(value) && value.includes(opt.letter) : value === opt.letter;
            const isKey = keys.includes(opt.letter);
            const classes = ['opt'];
            if (reveal) {
              if (isKey) classes.push('correct');
              else if (isChosen) classes.push('wrong');
              classes.push('disabled');
            } else if (isChosen) {
              classes.push('selected');
            }
            return (
              <label key={opt.letter} className={classes.join(' ')}>
                <div className="opt-row">
                  <input
                    className="opt-input"
                    type={isSata ? 'checkbox' : 'radio'}
                    name={`opq_${item.id}`}
                    value={opt.letter}
                    disabled={reveal}
                    checked={isChosen}
                    onChange={(e) => pick(item, opt.letter, e.target.checked)}
                  />
                  <div className="opt-body">
                    <div className="opt-title">
                      <span className="opt-text">
                        <strong>{opt.letter.toUpperCase()}.</strong> {opt.text}
                      </span>
                      {reveal && isKey ? <span className="badge badge-correct">✓ Correct answer</span> : null}
                      {reveal && isChosen && !isKey ? <span className="badge badge-wrong">✗ Your answer</span> : null}
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        {isSata && !reveal ? (
          <div className="sata-check-row">
            {way === 'go' ? (
              <button type="button" className="btn btn-primary" disabled={!hasAnswer(item, value)} onClick={() => checkSata(item)}>
                Check answer
              </button>
            ) : null}
            <div className="sata-check-note">Select all that apply.</div>
          </div>
        ) : null}
        {reveal ? (
          <p className={`ofp-verdict ofp-${mark}`} role="status">
            {mark === 'right' ? 'Right.' : mark === 'wrong' ? `Not quite. The answer is ${answerWords(item)}.` : `Left blank. The answer is ${answerWords(item)}.`}
          </p>
        ) : null}
      </div>
    );
  }

  const item = items[index];
  const last = index === total - 1;
  const progress = finished ? 100 : total ? Math.round((answeredCount / total) * 100) : 0;
  const wayName = way === 'go' ? 'Answer as you go' : 'Answers at the end';

  return (
    <div className="runner ofp">
      <div className="runner-header">
        <div className="header-top">
          <div className="header-brand">Quademia</div>
          <div className="header-title">
            {title} · {wayName}
          </div>
          <div className="header-actions">
            {!finished ? (
              <span className="hbtn hbtn-ghost ofp-count" aria-label={`Question ${index + 1} of ${total}`}>
                {index + 1} / {total}
              </span>
            ) : null}
            <Link href={exitHref} className="hbtn hbtn-ghost" onClick={(e) => void leave(e)}>
              Leave
              <LinkPending />
            </Link>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-fill locked" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="runner-wrap">
        {!total ? (
          <div className="q-block">
            <div className="q-stem">This pack has no questions.</div>
          </div>
        ) : !finished ? (
          <>
            {question(item, index, way === 'go' && Boolean(shown[item.id]))}
            <div className="page-nav">
              <button type="button" className="btn btn-ghost btn-lg" disabled={index === 0} onClick={() => go(index - 1)}>
                Previous
              </button>
              {last ? (
                <button type="button" className="btn btn-accent btn-lg" onClick={finish}>
                  {way === 'go' ? 'See your score' : 'Finish'}
                </button>
              ) : (
                <button type="button" className="btn btn-accent btn-lg" onClick={() => go(index + 1)}>
                  Next question
                </button>
              )}
            </div>
          </>
        ) : reviewing !== null ? (
          <>
            {question(items[reviewing], reviewing, true)}
            <div className="page-nav">
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => setReviewing(null)}>
                Back to your score
              </button>
              <div className="page-nav-right">
                <button type="button" className="btn btn-ghost btn-lg" disabled={reviewing === 0} onClick={() => setReviewing(reviewing - 1)}>
                  Previous
                </button>
                <button type="button" className="btn btn-ghost btn-lg" disabled={reviewing === total - 1} onClick={() => setReviewing(reviewing + 1)}>
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="ofp-end">
            <div className="q-block ofp-score">
              <span className="ofp-eyebrow">Your score</span>
              <span className="ofp-big">
                {right} of {total}
              </span>
              <span className="ofp-line">
                {pct}%{blank ? ` · ${blank} left blank` : ''}
              </span>
            </div>
            <h2 className="ofp-h">Each answer</h2>
            <ul className="ofp-list">
              {items.map((it, i) => {
                const m = marks[i];
                const words =
                  m === 'right'
                    ? `Right · ${answerWords(it)}`
                    : m === 'wrong'
                      ? `You chose ${chosenWords(chosen[it.id])} · the answer is ${answerWords(it)}`
                      : `Left blank · the answer is ${answerWords(it)}`;
                return (
                  <li key={it.id}>
                    <button type="button" className="ofp-row" onClick={() => setReviewing(i)}>
                      <span className="ofp-n">{i + 1}</span>
                      <span className="ofp-words">{words}</span>
                      <span className={`ofp-mark ofp-${m}`} aria-label={m === 'right' ? 'right' : m === 'wrong' ? 'wrong' : 'left blank'}>
                        {m === 'right' ? '✓' : m === 'wrong' ? '✗' : '–'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="ofp-line">Tap a question to see it with its answer.</p>
            <div className="page-nav">
              <AppLink href={exitHref} className="btn btn-ghost btn-lg">
                Back to the pack
              </AppLink>
              <button type="button" className="btn btn-accent btn-lg" onClick={again}>
                Practise again
              </button>
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
