// app/(app)/runner/timed/page.tsx — legacy runner/timed.html.
//
// The exam-mode runner. The server half runs legacy's preflight
// (lib/attempts/runner-load: the ten checks, in order, with their words)
// before anything reaches the browser: a redirect for the wrong runner
// or the wrong review flag, the error card for a refusal, otherwise the
// attempt, its items in order and the two config values handed to the
// runner core with `mode="timed"`.
//
// No sidebar, as legacy: the runner sits under the (app) auth boundary
// with its own header (rebuild.md §12 slice 6).

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { loadRunner } from '@/lib/attempts/runner-load';
import { QuizRunner } from '@/components/runner/quiz-runner';
import { RunnerError } from '@/components/runner/runner-error';
import '@/styles/runner.css';

export const metadata: Metadata = {
  title: 'Exam Quiz | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

type Params = { attempt_id?: string; review?: string; preview?: string };

export default async function TimedRunnerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireStudent();
  const sp = await searchParams;

  const load = await loadRunner(gate, 'timed', {
    attemptId: String(sp.attempt_id || ''),
    review: sp.review === '1',
    preview: sp.preview === '1',
  });

  if (load.kind === 'redirect') redirect(load.to);
  if (load.kind === 'error') return <RunnerError title={load.title} message={load.message} />;

  return (
    <QuizRunner
      mode="timed"
      attempt={load.attempt}
      items={load.items}
      secrets={load.secrets}
      questionsPerPage={load.questionsPerPage}
      reviewMode={load.reviewMode}
      previewMode={load.previewMode}
    />
  );
}
