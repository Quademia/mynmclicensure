// lib/bank/csv.ts
//
// The CSV importer's reading and row rules (slice 4b), transcribed from
// legacy admin/question-bank.html: parseCsv, splitCsvLine, the template
// row, and the payload shape runCsvImport built. Pure functions, no
// database: the browser runs them to show the row report before anything
// is sent, and the import action runs them again on what it receives.
//
// One change from legacy, approved by Sam (2026-09-13): the reader
// handles a quoted comma, an escaped quote ("") and a line break inside
// a field. Legacy's splitter toggled on every quote and split on every
// newline, so such a row landed in the wrong columns and was skipped or
// mangled. Every row RULE is unchanged and in legacy's order:
//   1. a row with fewer than 3 columns is skipped;
//   2. no stem → skipped;
//   3. no correct answer → skipped;
//   4. neither option_a nor option_b → skipped ("at least 2 options");
//   5. a blank item_id is generated: <COURSEID without _>_<ms>_<row index>;
//   6. question_type upper-cased, default MCQ;
//   7. marks parsed as a number, default 1;
//   8. shuffle_options is false only when the cell says "false";
//   9. rows are upserted on item_id, 50 at a time (the action).
//
// 08 B4 (2026-09-26) adds three columns and one rule. The rule: a row
// whose question type, difficulty or level is not on its list is skipped
// with the word named; the match ignores case and the row takes the
// list's spelling, so `easy` lands as Easy and "T/F" is refused. The
// table's CHECKs are the floor; this is the words before it. The
// columns: bloom_level, question_ref, and tags split on semicolons. A
// file that has no such column leaves the row's value as it is — every
// file made before B4 lacks all three, and re-importing one must not
// wipe a level or tags set in the editor since. One alias: the level
// "Analyze", MyNclex's spelling, lands as "Analyse" (Sam, 2026-09-26) —
// the same word, so a file carried over from MyNclex is not refused.

import { BLOOM_LEVELS, CSV_COLUMNS, DIFFICULTIES, OPTION_LETTERS, QUESTION_TYPES, normaliseTags } from './types';

// The three B4 columns a file may or may not carry.
const B4_COLUMNS = ['bloom_level', 'question_ref', 'tags'] as const;

// Spellings of a level that mean one of the six, keyed lower-case.
const LEVEL_ALIASES: Record<string, string> = { analyze: 'Analyse' };

/** "A, B or C" — the list as the refusal names it. */
function spoken(list: readonly string[]): string {
  return list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

/** The list's own spelling of `value`, matched without case; null when it is not on the list. */
function onList(list: readonly string[], value: string): string | null {
  const v = value.trim().toLowerCase();
  return list.find((w) => w.toLowerCase() === v) ?? null;
}

/**
 * The three list columns of one row, checked and spelled the list's way.
 * Returns the reason when a word is not on its list ("question type
 * "T/F" is not MCQ, TF or SATA"); otherwise fixes the row in place and
 * returns null. A blank type is MCQ (legacy's default); a blank
 * difficulty or level stays blank. Run by the browser for the report and
 * again by the import action on what it receives.
 */
export function checkListColumns(row: CsvRow): string | null {
  const type = (row.question_type || '').trim();
  if (type) {
    const t = onList(QUESTION_TYPES, type);
    if (!t) return `question type "${type}" is not ${spoken(QUESTION_TYPES)}`;
    row.question_type = t;
  } else {
    row.question_type = 'MCQ';
  }

  const difficulty = (row.difficulty || '').trim();
  if (difficulty) {
    const d = onList(DIFFICULTIES, difficulty);
    if (!d) return `difficulty "${difficulty}" is not ${spoken(DIFFICULTIES)}`;
    row.difficulty = d;
  }

  const level = (row.bloom_level || '').trim();
  if (level) {
    const l = onList(BLOOM_LEVELS, level) ?? LEVEL_ALIASES[level.toLowerCase()] ?? null;
    if (!l) return `level "${level}" is not ${spoken(BLOOM_LEVELS)}`;
    row.bloom_level = l;
  }
  return null;
}

export type CsvRow = Record<string, string>;

export type CsvReportLine = { ok: boolean; msg: string };

export type CsvParseResult = {
  rows: CsvRow[];
  validCount: number;
  report: CsvReportLine[];
};

/** RFC-4180-style reader: quotes, "" escapes, newlines inside quotes, CRLF, BOM. */
export function readCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.length > 1 || row[0].trim() !== '') records.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    if (row.length > 1 || row[0].trim() !== '') records.push(row);
  }
  return records;
}

/** Legacy parseCsv: header → keys, then the row rules with legacy's words. */
export function parseCsv(text: string, courseId: string): CsvParseResult {
  const records = readCsv(text);
  if (records.length < 2) {
    return { rows: [], validCount: 0, report: [{ ok: false, msg: 'CSV is empty or has no data rows.' }] };
  }

  const header = records[0].map((h) => h.trim().toLowerCase());
  const report: CsvReportLine[] = [];
  const rows: CsvRow[] = [];
  const now = Date.now();

  for (let i = 1; i < records.length; i++) {
    const cols = records[i];
    const rowNum = i + 1;

    if (cols.length < 3) {
      report.push({ ok: false, msg: `Row ${rowNum}: too few columns — skipped.` });
      continue;
    }

    const row: CsvRow = {};
    header.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

    if (!row.stem) {
      report.push({ ok: false, msg: `Row ${rowNum}: missing stem — skipped.` });
      continue;
    }
    if (!row.correct) {
      report.push({ ok: false, msg: `Row ${rowNum}: missing correct answer — skipped.` });
      continue;
    }
    if (!row.option_a && !row.option_b) {
      report.push({ ok: false, msg: `Row ${rowNum}: must have at least 2 options — skipped.` });
      continue;
    }
    const offList = checkListColumns(row);
    if (offList) {
      report.push({ ok: false, msg: `Row ${rowNum}: ${offList} — skipped.` });
      continue;
    }

    if (!row.item_id) {
      row.item_id = courseId.replace(/_/g, '') + '_' + now + '_' + i;
    }

    rows.push(row);
    report.push({ ok: true, msg: `Row ${rowNum}: "${row.stem.slice(0, 60)}…" — ready to import.` });
  }

  return { rows, validCount: rows.length, report };
}

/**
 * Legacy runCsvImport's payload for one row (rationale_img is never set).
 * The row has been through checkListColumns(), so the three list words
 * are already the lists' spellings. The B4 columns go in only when the
 * file has them (see the header); the two switches never do — a new row
 * takes the table's defaults (a draft, not free) and an existing row
 * keeps its own.
 */
export function rowToPayload(row: CsvRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    item_id: row.item_id,
    question_type: (row.question_type || 'MCQ').toUpperCase(),
    stem: row.stem,
    correct: row.correct,
    rationale: row.rationale || null,
    subject: row.subject || null,
    maintopic: row.maintopic || null,
    subtopic: row.subtopic || null,
    difficulty: row.difficulty || null,
    marks: parseFloat(row.marks) || 1,
    batch_id: row.batch_id || null,
    shuffle_options: row.shuffle_options !== 'false',
  };
  for (const l of OPTION_LETTERS) {
    payload[`option_${l}`] = row[`option_${l}`] || null;
    payload[`fb_${l}`] = row[`fb_${l}`] || null;
  }
  for (const col of B4_COLUMNS) {
    if (!(col in row)) continue;
    payload[col] = col === 'tags' ? normaliseTags((row.tags || '').split(';')) : row[col] || null;
  }
  return payload;
}

/** Legacy downloadTemplate: the header and one example row. */
export function csvTemplate(courseId: string): string {
  const header = CSV_COLUMNS.join(',');
  const example = [
    courseId + '_EXAMPLE',
    'MCQ',
    'What is the normal resting heart rate for an adult?',
    '40-60 bpm', 'Too low — bradycardia',
    '60-100 bpm', 'Correct — normal resting HR',
    '100-120 bpm', 'Too high — tachycardia',
    '120-140 bpm', 'Too high',
    '', '', '', '',
    'b',
    'The normal resting heart rate for adults is 60-100 bpm.',
    'Anatomy', 'Cardiovascular', 'Heart rate',
    'Easy', '1', 'GP_BATCH_001', 'true',
    'Remember', 'Example source', 'vital signs;adult',
  ].join(',');
  return header + '\n' + example;
}
