// components/practice-papers/paper-actions.tsx
//
// The buttons of Practice Papers that do something (04.7; Sam,
// 2026-10-12): Start or Resume a sitting, and Practise again — a box with
// the paper's ways, each with its own button. Everything else on the three
// screens is server-rendered markup. The Mock exams page (04.15) uses the
// same two, with `kind="mock"`.
//
// A Server Action whose request fails rejects, so every call is caught and
// the button given back (AGENTS.md, Known Workarounds).

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { retakeAttempt, spawnQuizAttempt } from '@/lib/attempts/actions';
import { sessionHref } from '@/lib/attempts/links';
import type { AttemptMode } from '@/lib/attempts/types';
import type { QuizKind } from '@/lib/quizzes/types';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { Toast } from '@/lib/toast/toast';

/** One way to sit a paper, as the box lists it. */
export type Way = {
  mode: AttemptMode;
  name: string;
  blurb: string;
  /** Start a new sitting, pick one up, or sit a finished mode again. */
  action: 'start' | 'resume' | 'retake';
  /** For a retake: the finished sitting it repeats. */
  originId?: string;
};

type Msg = { text: string; tone: 'error' } | null;

const OFFLINE = 'Could not start. Please check your connection and try again.';

function useLaunch(kind: QuizKind) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  async function launch(key: string, quizId: string, way: Pick<Way, 'mode' | 'action' | 'originId'>) {
    if (busy) return;
    setBusy(key);
    try {
      const result =
        way.action === 'retake' && way.originId
          ? await retakeAttempt(way.originId)
          : await spawnQuizAttempt(kind, quizId, way.mode);
      if (!result.ok) {
        setBusy(null);
        setMsg({ text: result.error || 'Could not start. Please try again.', tone: 'error' });
        return;
      }
      router.push(sessionHref(result.attemptId));
    } catch {
      setBusy(null);
      setMsg({ text: OFFLINE, tone: 'error' });
    }
  }

  const toast = <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={() => setMsg(null)} />;
  return { busy, launch, toast };
}

/** Start or Resume: the main button of a card. */
export function LaunchButton({
  quizId,
  mode,
  label,
  kind = 'fixed',
}: {
  quizId: string;
  mode: AttemptMode;
  label: string;
  kind?: QuizKind;
}) {
  const { busy, launch, toast } = useLaunch(kind);
  return (
    <>
      <button
        type="button"
        className="btn btn-lg btn-accent"
        disabled={Boolean(busy)}
        onClick={() => launch('main', quizId, { mode, action: 'start' })}
      >
        {busy ? 'Starting…' : label}
      </button>
      {toast}
    </>
  );
}

/** Practise again: the box with the paper's ways. */
export function PractiseAgain({ quizId, title, ways, kind = 'fixed' }: { quizId: string; title: string; ways: Way[]; kind?: QuizKind }) {
  const [open, setOpen] = useState(false);
  const { busy, launch, toast } = useLaunch(kind);
  return (
    <>
      <button type="button" className="btn btn-accent btn-lg" onClick={() => setOpen(true)}>
        Practise again
      </button>
      <Dialog open={open} onClose={() => (busy ? undefined : setOpen(false))} title={`Practise ${title} again`}>
        <ul className="pp-ways">
          {ways.map((w) => (
            <li key={w.mode} className="pp-way">
              <div className="pp-way-text">
                <span className="pp-way-name">{w.name}</span>
                <span className="pp-way-blurb">{w.blurb}</span>
              </div>
              <button
                type="button"
                className="btn btn-accent"
                disabled={Boolean(busy)}
                onClick={() => launch(w.mode, quizId, w)}
              >
                {busy === w.mode ? 'Starting…' : w.action === 'resume' ? 'Resume' : w.action === 'retake' ? 'Retake' : 'Start'}
              </button>
            </li>
          ))}
        </ul>
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
      {toast}
    </>
  );
}
