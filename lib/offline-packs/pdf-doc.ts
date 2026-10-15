// lib/offline-packs/pdf-doc.ts — a pack's PDF, described for pdfmake (07.5;
// Sam, 2026-10-15, drawn at https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm,
// "The PDF — printable copy (A4)"). A plain description, no pdfmake import:
// lib/offline-packs/pdf.ts hands it to pdfmake on the phone.
//
//   - the cover: the painted Q and wordmark, "Offline pack · Course", the
//     pack's name, its questions and what was picked, Prepared for and
//     Made, How to use this pack. Clean: no pattern.
//   - the questions in two columns flowing column to column and page to page
//     (pdfmake's snaking columns), about ten a page, a question never split
//     across a column or a page.
//   - the answers: on the last page by default (a grid, "3  a, c, e"), or
//     after each question ("Answer: b"), the student's choice.
//   - the marks (Sam): on every page but the cover a faint pattern of small
//     slanted rows — "QUADEMIA · MyNMCLicensure · name · date · Pack code" —
//     drawn as text behind the page; the footer line with the same code; the
//     student's account in the file's details; the "no copying" setting.
//     No explanation, picture or feedback (07.6): only what the pack holds.
//
// The colours are the app's (styles/tokens.css): navy, teal, the inks and
// the border. The font is Roboto (pdfmake's own, served from public/fonts):
// the PDF's built-in fonts cannot print "₂" or "≈", which the bank has.

import type { PackQuestion } from './questions';

export type PdfAnswers = 'end' | 'each';

export type PackPdf = {
  packId: string;
  packName: string;
  courseTitle: string;
  /** What was picked, in a line (labels.pickedWords). */
  picked: string;
  createdUtc: string;
  ownerName: string;
  ownerEmailMask: string;
  questions: PackQuestion[];
  answers: PdfAnswers;
  /** The painted Q as a data URL (public/images/quademia-mark-64.png). */
  markDataUrl: string | null;
};

const NAVY = '#1e3a5f';
const TEAL = '#2d7d72';
const INK = '#111827';
const MUTED = '#6b7280';
const SOFT = '#4b5563';
const LINE = '#e5e7eb';
const TINT = '#f9fafb';

/**
 * The pattern's strength. Sam: print one page on an ordinary printer and set
 * it from that; 0.08 is the drawing's.
 */
export const PATTERN_OPACITY = 0.08;

const A4_W = 595.28;
const A4_H = 841.89;
const SIDE = 40;
const CONTENT_W = A4_W - SIDE * 2;
const NBSP = ' ';

/** The short code printed on every page: the pack id's random tail. */
export function packCode(packId: string): string {
  const tail = String(packId || '').split('_').pop() || '';
  return (tail.length >= 4 ? tail : String(packId || '').slice(-8)).toUpperCase();
}

function longDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "b" or "a, c, e" — as the player says it, lower case as the options print. */
function answerLetters(correct: string): string {
  return String(correct || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

function xml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The faint slanted rows behind a page: one SVG, its text in the PDF's own font. */
function patternSvg(mark: string): string {
  const gap = `${NBSP.repeat(4)}·${NBSP.repeat(4)}`;
  const row = xml(Array.from({ length: 5 }, () => mark).join(gap));
  const rows: string[] = [];
  for (let i = 0, y = -340; y < A4_H + 360; i++, y += 35) {
    rows.push(`<text x="${i % 2 ? -200 : -320}" y="${y}">${row}</text>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_W}" height="${A4_H}" viewBox="0 0 ${A4_W} ${A4_H}">` +
    `<g transform="rotate(-30 ${A4_W / 2} ${A4_H / 2})" fill="${NAVY}" fill-opacity="${PATTERN_OPACITY}" font-family="Roboto" font-weight="bold" font-size="9">` +
    rows.join('') +
    '</g></svg>'
  );
}

function questionBlock(q: PackQuestion, n: number, answers: PdfAnswers, last: boolean) {
  // a select-all question says so, unless the bank's wording already does
  const stem = q.question_type === 'SATA' && !/select all/i.test(q.stem) ? `${q.stem} (Select all that apply)` : q.stem;
  const lines: Record<string, unknown>[] = [
    { text: stem, fontSize: 11.5, bold: true, lineHeight: 1.2, margin: [0, 0, 0, 4] },
    ...q.options.map((o) => ({ text: `${o.letter}. ${o.text}`, fontSize: 11, lineHeight: 1.2, margin: [0, 0, 0, 2] })),
  ];
  if (answers === 'each') {
    lines.push({ text: `Answer: ${answerLetters(q.correct)}`, fontSize: 10, bold: true, color: TEAL, margin: [0, 3, 0, 0] });
  }
  return {
    unbreakable: true,
    // no space after the last: at the foot of a full column it would start a blank page
    margin: [0, 0, 0, last ? 0 : 14],
    columns: [
      { width: 18, text: `${n}.`, fontSize: 11.5, bold: true, color: NAVY },
      { width: '*', stack: lines },
    ],
    columnGap: 4,
  };
}

function cover(p: PackPdf) {
  const n = p.questions.length;
  const how =
    p.answers === 'each'
      ? 'Each question ends with its answer. For the explanations, practise these topics in the app.'
      : 'Answer every question first. The answers are on the last page. For the explanations, practise these topics in the app.';
  const wordmark = {
    stack: [
      { text: 'QUADEMIA', fontSize: 9, bold: true, color: TEAL, characterSpacing: 0.9 },
      { text: 'MyNMCLicensure', fontSize: 15, bold: true, color: NAVY },
    ],
  };
  return [
    {
      margin: [16, 0, 16, 0],
      stack: [
        p.markDataUrl ? { columns: [{ image: p.markDataUrl, width: 36, height: 36 }, { ...wordmark, margin: [0, 3, 0, 0] }], columnGap: 10 } : wordmark,
        { text: `OFFLINE PACK · ${p.courseTitle.toUpperCase()}`, fontSize: 10.5, bold: true, color: TEAL, characterSpacing: 0.9, margin: [0, 130, 0, 8] },
        { text: p.packName, fontSize: 34, bold: true, color: NAVY, lineHeight: 1.1 },
        { text: `${n} ${n === 1 ? 'question' : 'questions'} · ${p.picked}`, fontSize: 13, color: SOFT, margin: [0, 8, 0, 0] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_W - 32, y2: 0, lineWidth: 0.75, lineColor: LINE }], margin: [0, 36, 0, 16] },
        {
          columns: [
            {
              stack: [
                { text: 'PREPARED FOR', fontSize: 9, bold: true, color: MUTED, characterSpacing: 0.6 },
                { text: p.ownerName, fontSize: 13, bold: true, margin: [0, 2, 0, 0] },
              ],
            },
            {
              stack: [
                { text: 'MADE', fontSize: 9, bold: true, color: MUTED, characterSpacing: 0.6 },
                { text: longDay(p.createdUtc), fontSize: 13, bold: true, margin: [0, 2, 0, 0] },
              ],
            },
          ],
          columnGap: 16,
        },
        {
          margin: [0, 28, 0, 0],
          table: {
            widths: ['*'],
            body: [
              [
                {
                  fillColor: TINT,
                  margin: [10, 10, 10, 10],
                  stack: [
                    { text: 'How to use this pack', fontSize: 11, bold: true },
                    { text: how, fontSize: 11, color: SOFT, lineHeight: 1.3, margin: [0, 4, 0, 0] },
                  ],
                },
              ],
            ],
          },
          layout: { hLineWidth: () => 0.75, vLineWidth: () => 0.75, hLineColor: () => LINE, vLineColor: () => LINE },
        },
      ],
      pageBreak: 'after',
    },
  ];
}

function answersPage(p: PackPdf) {
  const cells: Record<string, unknown>[] = p.questions.map((q, i) => ({
    text: [
      { text: `${i + 1}${NBSP}${NBSP}${NBSP}`, fontSize: 10, color: MUTED },
      { text: answerLetters(q.correct), fontSize: 12, bold: true },
    ],
    margin: [8, 6, 8, 6],
  }));
  const rows: Record<string, unknown>[][] = [];
  for (let i = 0; i < cells.length; i += 3) {
    const row = cells.slice(i, i + 3);
    while (row.length < 3) row.push({ text: '', margin: [8, 6, 8, 6] });
    rows.push(row);
  }
  return [
    { text: 'Answers', fontSize: 18, bold: true, color: NAVY, pageBreak: 'before' },
    { text: 'Check your work. For the explanations, practise these topics in the app.', fontSize: 11, color: SOFT, margin: [0, 4, 0, 14] },
    {
      table: { widths: ['*', '*', '*'], body: rows, dontBreakRows: true },
      layout: { hLineWidth: () => 0.75, vLineWidth: () => 0.75, hLineColor: () => LINE, vLineColor: () => LINE },
    },
  ];
}

/** The whole document; `ownerPassword` locks its settings (made fresh each time, never kept). */
export function packPdfDoc(p: PackPdf, ownerPassword: string): Record<string, unknown> {
  const code = packCode(p.packId);
  const mark = `QUADEMIA · MyNMCLicensure · ${p.ownerName} · ${shortDay(p.createdUtc)} · Pack ${code}`;
  const pattern = patternSvg(mark);
  const foot = `For ${p.ownerName} · ${p.ownerEmailMask} · Pack ${code} · personal study only, do not share`;

  return {
    pageSize: 'A4',
    pageMargins: [SIDE, 64, SIDE, 56],
    // PDF 1.7: the settings below are locked with AES, which every reader honours
    version: '1.7',
    ownerPassword,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
    info: {
      title: p.packName,
      author: p.ownerName,
      subject: `Offline pack ${code} · ${p.courseTitle} · for ${p.ownerName} (${p.ownerEmailMask})`,
      keywords: `${p.packId} · personal study only`,
      creator: 'Quademia · MyNMCLicensure',
    },
    defaultStyle: { font: 'Roboto', fontSize: 11, color: INK },
    background: (page: number) => (page === 1 ? null : { svg: pattern, width: A4_W, height: A4_H, absolutePosition: { x: 0, y: 0 } }),
    header: (page: number) =>
      page === 1
        ? null
        : {
            margin: [SIDE, 30, SIDE, 0],
            stack: [
              {
                columns: [
                  { width: '*', text: [{ text: p.packName, bold: true, color: NAVY }, ` · ${p.courseTitle}`], fontSize: 9.5, color: MUTED },
                  { width: 'auto', text: `Pack ${code}`, fontSize: 9.5, color: MUTED },
                ],
              },
              { canvas: [{ type: 'line', x1: 0, y1: 6, x2: CONTENT_W, y2: 6, lineWidth: 0.75, lineColor: LINE }] },
            ],
          },
    footer: (page: number, pages: number) => ({
      margin: [SIDE, 14, SIDE, 0],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineWidth: 0.75, lineColor: LINE }] },
        {
          margin: [0, 6, 0, 0],
          columns: [
            { width: '*', text: foot, fontSize: 8.5, color: MUTED },
            { width: 'auto', text: `${page} / ${pages}`, fontSize: 8.5, color: MUTED },
          ],
        },
      ],
    }),
    content: [
      ...cover(p),
      {
        columns: [
          { width: '*', stack: p.questions.map((q, i) => questionBlock(q, i + 1, p.answers, i === p.questions.length - 1)) },
          { width: '*', text: '' },
        ],
        columnGap: 24,
        snakingColumns: true,
      },
      ...(p.answers === 'end' ? answersPage(p) : []),
    ],
  };
}
