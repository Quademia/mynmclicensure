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

import { CSV_COLUMNS, OPTION_LETTERS } from './types';

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

    if (!row.item_id) {
      row.item_id = courseId.replace(/_/g, '') + '_' + now + '_' + i;
    }

    rows.push(row);
    report.push({ ok: true, msg: `Row ${rowNum}: "${row.stem.slice(0, 60)}…" — ready to import.` });
  }

  return { rows, validCount: rows.length, report };
}

/** Legacy runCsvImport's payload for one row (rationale_img is never set). */
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
  ].join(',');
  return header + '\n' + example;
}
