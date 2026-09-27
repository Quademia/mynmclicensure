// app/(app)/session/[attempt_id]/page.tsx — one sitting, one address.
//
// 03 Q8 (Sam, 2026-09-27), replacing legacy's two runner pages
// (runner/instant.html and runner/timed.html, ported as /runner/instant
// and /runner/timed). The server half runs the preflight
// (lib/attempts/runner-load: the checks, in order, with their words)
// before anything reaches the browser: the error card for a refusal; a
// finished sitting's review, questions and all; or, for a live sitting,
// the start card (03 Q17) — its data only, no question. Start or Resume
// on the card asks the server for the questions and mounts the runner,
// which reads the mode from the attempt and the mode's behaviour from
// lib/attempts/modes. `?preview=1` is the admin's read-only view of any
// attempt.
//
// No sidebar, as legacy: the runner sits under the (app) auth boundary
// with its own header (rebuild.md §12 slice 6).

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { loadRunner } from '@/lib/attempts/runner-load';
import { QuizRunner } from '@/components/runner/quiz-runner';
import { RunnerError } from '@/components/runner/runner-error';
import { SessionStart } from '@/components/runner/session-start';
import '@/styles/runner.css';

export const metadata: Metadata = {
  title: 'Quiz | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ attempt_id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const gate = await requireStudent();
  const { attempt_id } = await params;
  const sp = await searchParams;

  const load = await loadRunner(gate, {
    attemptId: String(attempt_id || ''),
    preview: sp.preview === '1',
  });

  if (load.kind === 'error') return <RunnerError title={load.title} message={load.message} exit={load.exit} />;
  if (load.kind === 'start') return <SessionStart card={load.card} exit={load.exit} previewMode={load.previewMode} />;

  return (
    <QuizRunner
      attempt={load.attempt}
      items={load.items}
      secrets={load.secrets}
      questionsPerPage={load.questionsPerPage}
      reviewMode
      previewMode={load.previewMode}
      exit={load.exit}
    />
  );
}
