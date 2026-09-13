// Local component fixture: no auth, database, or production routes.
// Run node scripts/preview-timed-runner.mjs, then open localhost:3106.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const actions = `
const key = 'codex_6b_fixture';
export const read = () => JSON.parse(localStorage.getItem(key) || 'null');
const write = (row) => localStorage.setItem(key, JSON.stringify(row));
export async function markTimedAttemptStarted() {
  const row = read();
  if (row.time_taken_s === null) { row.ts_iso = new Date().toISOString(); row.time_taken_s = 0; write(row); }
  return { ok: true, startedIso: row.ts_iso };
}
export async function saveTimedAttemptProgress(id, answers) {
  const row = read();
  if (row.status !== 'in_progress') return { ok: false, error: 'Already submitted' };
  row.answers_json = JSON.stringify(answers); write(row); return { ok: true };
}
export const saveAttemptProgress = saveTimedAttemptProgress;
export async function finishAttempt(id, answers) {
  const row = read(); row.answers_json = JSON.stringify(answers); row.status = 'completed'; write(row);
  const raw = answers.filter(a => a.is_correct).length;
  return { ok: true, score: { raw, total: 2, pct: raw * 50 } };
}`;
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QuizRunner } from './components/runner/quiz-runner';
import { read } from '@/lib/attempts/actions';
const params = new URLSearchParams(location.search);
if (params.has('fresh')) localStorage.removeItem('codex_6b_fixture');
const mode = params.get('mode') || 'timed';
const seed = { attempt_id: 'fixture', display_label: 'Local runner test', course_id: 'GP', user_id: 'fixture', mode, source: 'builder', n: 2, duration_min: 1, time_taken_s: null, ts_iso: new Date().toISOString(), answers_json: '[]', status: 'in_progress', item_ids: 'one,two' };
if (!read()) localStorage.setItem('codex_6b_fixture', JSON.stringify(seed));
const attempt = read();
const base = { option_a: 'First option', option_b: 'Second option', option_c: 'Third option', correct: 'a', marks: 1, shuffle_options: false, rationale: 'Test explanation shown after submission.', fb_a: 'First option explanation.', difficulty: 'Easy' };
const items = [{ ...base, item_id: 'one', question_type: 'MCQ', stem: 'Choose the first option.' }, { ...base, item_id: 'two', question_type: 'SATA', correct: 'a,c', stem: 'Select the first and third options.' }];
createRoot(document.getElementById('root')).render(<QuizRunner mode={mode} attempt={attempt} items={items} questionsPerPage={1} autosaveMs={1000} reviewMode={attempt.status === 'completed'} previewMode={false} />);
`;
const result = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'fixture', setup(b) {
    b.onResolve({ filter: /^@\/lib\/attempts\/actions$/ }, () => ({ path: 'actions', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'actions' ? actions : 'export const useRouter = () => ({ push: () => { location.href = "/"; } });' }));
  } }],
});
const css = (await Promise.all(['styles/base.css', 'styles/runner.css'].map(p => readFile(p, 'utf8')))).join('\n');
const html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local runner test</title><style>' + css + '</style><div id="root"></div><script src="/fixture.js"></script>';
createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/fixture.js' ? result.outputFiles[0].text : html);
}).listen(3106, '127.0.0.1', () => console.log('Runner component fixture: http://127.0.0.1:3106/?fresh=1'));
