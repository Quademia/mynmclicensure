// Development-only integration check. Runs the real Server Actions with
// a supplied gate, against disposable rows in the known DEV schema.
// It verifies writes and ownership filters, not the auth gate or RLS.
// Run: node --env-file=.env.local scripts/verify-timed-attempts.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://zrakjibtxyzoqcdtvpmq.supabase.co', 'DEV only');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'licensure_gh' }, auth: { persistSession: false, autoRefreshToken: false },
});
const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const owner = unwrap(await db.from('users').select('user_id').eq('role', 'ADMIN').limit(1).single());
const item = unwrap(await db.from('items_gp').select('*').eq('question_type', 'MCQ').limit(1).single());
const course = unwrap(await db.from('courses').select('course_id').eq('course_id', 'GP').single());
globalThis.timedTestGate = { supabase: db, profile: owner };
const bundle = await build({
  entryPoints: ['lib/attempts/actions.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'test-gate', setup(b) {
    b.onResolve({ filter: /^@\/lib\/access$/ }, () => ({ path: 'gate', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export async function requireStudent() { return globalThis.timedTestGate; }' }));
  } }],
});
const actions = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const ids = Array.from({ length: 3 }, () => 'ATT_TEST_6B_' + randomUUID());
const row = (id) => db.from('attempts').select('*').eq('attempt_id', id).single().then(unwrap);
const answer = [{ item_id: item.item_id, chosen: item.correct.toLowerCase(), correct: 'wrong', is_correct: false, flagged: true, time_spent_s: null }];
try {
  unwrap(await db.from('attempts').insert(ids.map((id, i) => ({
    attempt_id: id, user_id: owner.user_id, course_id: course.course_id, mode: i === 2 ? 'instant' : 'timed',
    source: 'builder', item_ids: item.item_id, n: 1, duration_min: 1,
    status: 'in_progress', answers_json: '[]', ts_iso: new Date().toISOString(),
  }))));
  assert.equal((await actions.saveTimedAttemptProgress(ids[0], answer)).ok, true);
  assert.equal((await row(ids[0])).time_taken_s, null, 'preflight save must not start exam');
  const starts = await Promise.all([actions.markTimedAttemptStarted(ids[0]), actions.markTimedAttemptStarted(ids[0])]);
  assert(starts.every((s) => s.ok));
  assert.equal(starts[0].startedIso, starts[1].startedIso, 'concurrent tabs share one start');
  assert.equal((await actions.markTimedAttemptStarted(ids[0])).startedIso, starts[0].startedIso);
  assert.equal((await actions.markTimedAttemptStarted(ids[2])).ok, false, 'cannot start instant as timed');
  globalThis.timedTestGate = { supabase: db, profile: { user_id: 'NOT_THE_OWNER' } };
  assert.equal((await actions.markTimedAttemptStarted(ids[1])).ok, false);
  assert.equal((await actions.saveTimedAttemptProgress(ids[0], [])).ok, false);
  globalThis.timedTestGate = { supabase: db, profile: owner };
  unwrap(await db.from('attempts').update({ ts_iso: new Date(Date.now() - 30000).toISOString() }).eq('attempt_id', ids[0]));
  assert.equal((await actions.saveTimedAttemptProgress(ids[0], answer)).ok, true);
  const saved = await row(ids[0]);
  assert(saved.time_taken_s >= 30 && saved.time_taken_s < 60);
  assert.equal(JSON.parse(saved.answers_json)[0].flagged, true);
  const finished = await actions.finishAttempt(ids[0], answer, 99999);
  assert(finished.ok);
  assert.equal(finished.score.pct, 100, 'server recomputes tampered correctness');
  const finalRow = await row(ids[0]);
  assert(finalRow.time_taken_s < 60, 'ignores browser elapsed time');
  assert.equal((await actions.saveTimedAttemptProgress(ids[0], [])).ok, false);
  assert.equal((await row(ids[0])).status, 'completed');
  assert.equal((await actions.markTimedAttemptStarted(ids[0])).ok, false);
  assert.equal((await actions.finishAttempt(ids[0], [], 0)).ok, false);
  assert.equal((await actions.markTimedAttemptStarted(ids[1])).ok, true);
  unwrap(await db.from('attempts').update({ ts_iso: new Date(Date.now() - 90000).toISOString() }).eq('attempt_id', ids[1]));
  assert.equal((await actions.finishAttempt(ids[1], [], 0)).ok, true);
  assert.equal((await row(ids[1])).time_taken_s, 60, 'expired time capped at duration');
  assert.equal((await row(ids[1])).score_pct, 0);
  assert.equal((await actions.finishAttempt(ids[2], answer, 12)).ok, true);
  assert.equal((await row(ids[2])).time_taken_s, 12, 'instant elapsed time unchanged');
  console.log('PASS: preflight, concurrent/repeated start, owner/mode guards, timed save, server scoring/time, late save, expiry, instant regression.');
} finally {
  unwrap(await db.from('attempts').delete().in('attempt_id', ids));
  assert.equal(unwrap(await db.from('attempts').select('attempt_id').in('attempt_id', ids)).length, 0);
  delete globalThis.timedTestGate;
  console.log('Disposable test attempts removed.');
}
