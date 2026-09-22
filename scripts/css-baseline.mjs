// scripts/css-baseline.mjs
//
// Guards the stylesheets against NEW hardcoded colours.
//
// WHY THIS EXISTS. On 2026-09-22, with the design system (doc 10, DS1–DS16)
// just finished, the stylesheets held 2,248 `var(--token)` references and
// still 606 colour literals written straight into a rule — roughly a fifth of
// every colour decision in the app, spread over 34 of the 35 files. None of
// them is a defect a student can see: each page is internally consistent. They
// matter because a token that nothing reads is not a change. DS14 learned that
// the small way — the price weight was moved at the token and three price
// rules had literals, so nothing moved — and this is the same fact at scale.
//
// The design system does not fix those 606. The plan is and remains ruling 9:
// a surface drops its own copy when work brings us there (DS3, DS9). This
// script exists for the other half of that plan — so that while the backlog is
// worked off one surface at a time, nothing is quietly added to it.
//
// ⚠ NOTHING ELSE IN THIS REPO READS CSS. ESLint sees `.ts`/`.tsx` only, and
// there is no PostCSS and no Tailwind (rebuild.md §3.1 — the stylesheet is the
// product's own). Before this script, a page written in a later session could
// invent its own teal, hardcode it in six places, and every check in the repo
// would still be green. The design system was a convention, not a constraint.
//
// WHAT IT DOES. The same thing `lint-baseline.mjs` does for ESLint, and
// deliberately in the same shape, so there is one idea here and not two:
// `.css-baseline.json` records how many literals each file is KNOWN to carry,
// and `--check` fails only when a count goes UP. A count that goes DOWN is
// reported as good news — that is a surface being converted under ruling 9 —
// and banked with `--update`.
//
// WHY A HAND-WRITTEN MATCHER AND NOT STYLELINT. Put to Sam on 2026-09-22 as a
// choice. Stylelint is the world's tool and its `declaration-strict-value`
// plugin is built for exactly this rule, but it has no notion of a baseline:
// freezing 606 and failing on the 607th is this file either way. So the real
// comparison was "stylelint + this wrapper" against "this wrapper alone", for
// a rule measured as narrow — 4 literals sat inside comments, 8 inside
// gradients, and nothing else needed a real parser. Sam chose one mechanism
// over two, on the DS6 precedent (icons kept as code rather than a package).
// If the gate ever has to grow past colours — spacing, radii, type — revisit
// that: a hand-written matcher is the wrong place to grow a parser.
//
// WHAT COUNTS AS A LITERAL. Two kinds, kept separate so the report names what
// it found:
//   colour-hex        #fff, #2d7d72, #rrggbbaa
//   colour-function   rgb( rgba( hsl( hsla( with a literal first argument
// A named colour (`color: white`) is NOT counted. It is a literal, but the
// pattern collides with token names — `--brand-navy`, `var(--brand-teal)` —
// and the false positives would cost more than the rule is worth. `white` and
// `black` also do not drift the way a brand colour does. Left out on purpose;
// if it is ever added, strip `var(...)` and custom-property names first.
//
// WHERE IT LOOKS. Every `.css` file in `styles/`, which on 2026-09-22 was
// every stylesheet in the repo — there are none elsewhere, and the TSX carried
// zero inline colour literals, so this gate has no side door. If either of
// those stops being true, this script is looking at less than it claims to.
//
// ⚠ `tokens.css` IS EXEMPT, and must be. It is the one file where a literal is
// the correct thing to write: it is where the colours are *defined*. Counting
// it would make the baseline fight the token file it exists to protect.
//
// HOW THE MATCHING AVOIDS FALSE POSITIVES. Three things are stripped before
// anything is counted, each for a reason seen in this repo:
//   comments      four literals sit in explanatory comments
//   selectors     only text INSIDE braces is read, so an id selector that
//                 happens to be hex-shaped (`#abc`) is never a colour
//   url(...)      `url(#filter)` is an SVG reference, not a colour
// Gradients are NOT stripped: `linear-gradient(#fff, #000)` is two real
// literals and should be caught.
//
// WHY COUNTS AND NOT LINE NUMBERS — the same reason as `lint-baseline.mjs`.
// Line numbers move on every edit, so a line-keyed baseline cries wolf on
// ordinary work and gets ignored within a week. A count per file survives
// edits and still catches a literal added to a file that already offends. The
// failure message still prints line numbers, because knowing the count went up
// is useless without knowing where.
//
// ⚠ RENAMES WILL TRIP IT, exactly as they trip the ESLint baseline: the
// baseline is keyed by path, so moving a stylesheet reads as "the old path was
// fixed, the new path is new". Re-run `npm run css:baseline` in the rename
// commit.
//
// Usage:
//   npm run css:check      compare every stylesheet against the baseline
//   npm run css:staged     same, but only stylesheets staged for commit (hook)
//   npm run css:baseline   re-record the baseline (do this deliberately)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repoRoot, '.css-baseline.json');
const mode = process.argv.includes('--update')
  ? 'update'
  : process.argv.includes('--staged')
    ? 'staged'
    : 'check';

/** The directory holding every stylesheet (AGENTS.md: "styles/ is top-level"). */
const STYLES_DIR = 'styles';

/** The one file where writing a colour literal is correct — see the header. */
const EXEMPT = new Set([`${STYLES_DIR}/tokens.css`]);

/**
 * The two kinds of literal this gate refuses.
 *
 * `colour-function` requires a literal first argument, so `rgb(var(--x) / .5)`
 * — a token being used, not a colour being invented — is not counted.
 */
const RULES = [
  { rule: 'colour-hex', pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { rule: 'colour-function', pattern: /\b(?:rgba?|hsla?)\(\s*[\d.]/gi },
];

/** Repo-relative, forward slashes — so the baseline is portable across machines. */
function relKey(absPath) {
  return relative(repoRoot, absPath).split('\\').join('/');
}

/** Every stylesheet the gate covers, exempt files already removed. */
function allStylesheets() {
  return readdirSync(join(repoRoot, STYLES_DIR))
    .filter((name) => name.endsWith('.css'))
    .map((name) => `${STYLES_DIR}/${name}`)
    .filter((path) => !EXEMPT.has(path))
    .sort();
}

/** Stylesheets staged for the current commit (added/copied/modified/renamed). */
function stagedStylesheets() {
  const out = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.endsWith('.css') && !EXEMPT.has(s));
}

/**
 * The parts of a stylesheet where a colour can legitimately appear: inside a
 * rule's braces, outside any comment. Returns one entry per line so the
 * failure message can say where.
 *
 * Walks character by character rather than using a regex, because comment and
 * brace state both cross line boundaries and a line-at-a-time regex cannot see
 * that it is halfway through a `/* ... *\/`.
 */
function declarationLines(css) {
  const out = [];
  let depth = 0;
  let inComment = false;
  let line = 1;
  let buf = '';
  let bufLine = 1;

  const flush = () => {
    if (buf.trim()) out.push({ line: bufLine, text: buf });
    buf = '';
  };

  for (let i = 0; i < css.length; i += 1) {
    const c = css[i];
    const next = css[i + 1];

    if (c === '\n') {
      flush();
      line += 1;
      continue;
    }
    if (inComment) {
      if (c === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (c === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (c === '{') {
      flush();
      depth += 1;
      continue;
    }
    if (c === '}') {
      flush();
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) {
      if (!buf) bufLine = line;
      buf += c;
    }
  }
  flush();
  return out;
}

/** `url(...)` can hold a `#fragment` that is a reference, never a colour. */
function stripUrls(text) {
  return text.replace(/url\([^)]*\)/gi, 'url()');
}

/** Tally literals per file per rule, and remember where each one sat. */
function collect(files) {
  const counts = {};
  const hits = {};
  let total = 0;

  for (const file of files) {
    let css;
    try {
      css = readFileSync(join(repoRoot, file), 'utf8');
    } catch {
      // Staged-then-deleted, or a path git named that is not on disk. Not this
      // script's problem: a file that does not exist carries no literals.
      continue;
    }

    for (const { line, text } of declarationLines(css)) {
      const scannable = stripUrls(text);
      for (const { rule, pattern } of RULES) {
        const found = scannable.match(pattern);
        if (!found) continue;
        const bucket = (counts[file] ??= {});
        bucket[rule] = (bucket[rule] ?? 0) + found.length;
        // Keep the matched colours themselves, not just the line. A long rule
        // truncates to nothing useful, and the literal is the whole point.
        // `colour-function` matches greedily into the first argument
        // (`rgba(12`), so trim that back to the function name.
        const literals = found.map((m) => m.replace(/\s*[\d.]+$/, '').trim());
        (hits[file] ??= []).push({ line, rule, literals, text: text.trim().slice(0, 70) });
        total += found.length;
      }
    }
  }

  return { counts, hits, total };
}

/** Sort keys so the committed baseline has a stable diff between runs. */
function sortDeep(counts) {
  const out = {};
  for (const file of Object.keys(counts).sort()) {
    out[file] = {};
    for (const rule of Object.keys(counts[file]).sort()) {
      out[file][rule] = counts[file][rule];
    }
  }
  return out;
}

let targets = allStylesheets();
if (mode === 'staged') {
  targets = stagedStylesheets();
  if (targets.length === 0) {
    console.log('No stylesheets staged — nothing to check.');
    process.exit(0);
  }
}

const { counts, hits, total } = collect(targets);

if (mode === 'update') {
  const baseline = {
    note:
      'Generated by `npm run css:baseline`. Do not hand-edit. Each entry is how ' +
      'many hardcoded colours a stylesheet is KNOWN to carry; `npm run css:check` ' +
      'fails only when a count goes UP. A count going DOWN is a surface being ' +
      'converted under ruling 9. See scripts/css-baseline.mjs for why.',
    totals: { literals: total },
    counts: sortDeep(counts),
  };
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
  console.log(
    `Baseline written: ${total} hardcoded colours across ${Object.keys(counts).length} stylesheets.`,
  );
  process.exit(0);
}

// ── check mode ────────────────────────────────────────────────────────────
let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
} catch {
  console.error(`No baseline found at ${relKey(baselinePath)}.`);
  console.error('Create one with:  npm run css:baseline');
  process.exit(2);
}

const base = baseline.counts ?? {};
const added = [];
const fixed = [];

for (const [file, rules] of Object.entries(counts)) {
  for (const [rule, now] of Object.entries(rules)) {
    const was = base[file]?.[rule] ?? 0;
    if (now > was) added.push({ file, rule, was, now });
  }
}

// Only meaningful for a whole-repo run. In `--staged` mode the stylesheets that
// were not scanned are absent from `counts`, and reading that as "fixed" would
// report the entire backlog as converted on every commit.
if (mode !== 'staged') {
  for (const [file, rules] of Object.entries(base)) {
    for (const [rule, was] of Object.entries(rules)) {
      const now = counts[file]?.[rule] ?? 0;
      if (now < was) fixed.push({ file, rule, was, now });
    }
  }
}

const wasTotal = baseline.totals?.literals ?? 0;

if (added.length > 0) {
  console.error(
    mode === 'staged'
      ? '\nNEW hardcoded colours in the stylesheets you are committing:\n'
      : `\nNEW hardcoded colours — ${wasTotal} known, ${total} now:\n`,
  );
  for (const a of added) {
    console.error(`  ${a.file}`);
    console.error(`      ${a.rule}: ${a.was} → ${a.now}`);
    // Print every literal in the offending file. The count says a new one
    // arrived; only the lines say which, and the new one is usually the line
    // the session just wrote.
    for (const h of hits[a.file] ?? []) {
      if (h.rule === a.rule) {
        console.error(`      line ${h.line}:  ${h.literals.join('  ')}   ${h.text}`);
      }
    }
  }
  console.error('\nUse a token from styles/tokens.css instead — `var(--brand-teal)`, not `#2d7d72`.');
  console.error('If the colour genuinely does not exist yet, add it to tokens.css and use it');
  console.error('from there, so one file still says what the app is painted in.');
  console.error('Do not re-baseline to hide it.\n');
  process.exit(1);
}

if (fixed.length > 0) {
  console.log(`\nBetter than baseline — ${wasTotal} known, ${total} now:\n`);
  for (const f of fixed) console.log(`  ${f.file}\n      ${f.rule}: ${f.was} → ${f.now}`);
  console.log('\nA surface converted under ruling 9. Bank it with:  npm run css:baseline\n');
  process.exit(0);
}

console.log(
  mode === 'staged'
    ? `No new hardcoded colours in ${targets.length} staged stylesheet${targets.length === 1 ? '' : 's'}.`
    : `No new hardcoded colours. ${total} known across ${Object.keys(counts).length} stylesheets — unchanged.`,
);
process.exit(0);
