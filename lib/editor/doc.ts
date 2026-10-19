// lib/editor/doc.ts
//
// The stored document (09.13), without Tiptap or React, so the server can
// use it: an empty document; its plain text (a list row's first line, the
// editor's character count); and the clean-up a save goes through, which
// keeps only the pieces a place's toolbar can make — the server's check,
// since a document arrives from a browser and is never trusted. Links keep
// only a web, email or in-app address; colours only the app's names; a
// Button only a safe address and a short label. Anything else is dropped,
// its words kept.

import {
  BUTTON_LABEL_MAX,
  MARKER_TONES,
  TEXT_TONES,
  type RichDoc,
  type RichMark,
  type RichNode,
  type ToolName,
} from './types';

export function emptyDoc(): RichDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** An address a document may keep: the web, email, or a path inside the app. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)\S+$/i.test(href) || /^\/(?!\/)\S*$/.test(href);
}

/** A path inside the app, opened by the app's own router. */
export function isAppPath(href: string): boolean {
  return /^\/(?!\/)/.test(href);
}

const TEXT_TONE_NAMES = new Set<string>(TEXT_TONES.map((t) => t.name));
const MARKER_TONE_NAMES = new Set<string>(MARKER_TONES.map((t) => t.name));

/** What a set of tools lets a document hold. */
function allowance(tools: readonly string[]) {
  const has = (t: ToolName) => tools.includes(t);
  return {
    marks: new Set<string>([
      ...(has('bold') ? ['bold'] : []),
      ...(has('italic') ? ['italic'] : []),
      ...(has('strike') ? ['strike'] : []),
      ...(has('superscript') ? ['superscript'] : []),
      ...(has('subscript') ? ['subscript'] : []),
      ...(has('highlight') ? ['marker'] : []),
      ...(has('color') ? ['tone'] : []),
      ...(has('link') ? ['link'] : []),
    ]),
    heading: has('subheading'),
    lists: has('bulletList') || has('orderedList'),
    callout: has('callout'),
    divider: has('divider'),
    button: has('button'),
  };
}
type Allowance = ReturnType<typeof allowance>;

function cleanMarks(marks: unknown, allow: Allowance): RichMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: RichMark[] = [];
  const seen = new Set<string>();
  for (const m of marks as RichMark[]) {
    const type = m && typeof m.type === 'string' ? m.type : '';
    if (!allow.marks.has(type) || seen.has(type)) continue;
    if (type === 'link') {
      const href = String(m.attrs?.href ?? '').trim();
      if (!isSafeHref(href)) continue;
      out.push({ type, attrs: { href } });
    } else if (type === 'tone') {
      const tone = String(m.attrs?.tone ?? '');
      if (!TEXT_TONE_NAMES.has(tone)) continue;
      out.push({ type, attrs: { tone } });
    } else if (type === 'marker') {
      const tone = String(m.attrs?.tone ?? '');
      if (!MARKER_TONE_NAMES.has(tone)) continue;
      out.push({ type, attrs: { tone } });
    } else {
      out.push({ type });
    }
    seen.add(type);
  }
  return out.length ? out : undefined;
}

/** Inline content: text and line breaks, the marks checked. */
function cleanInline(nodes: unknown, allow: Allowance): RichNode[] {
  if (!Array.isArray(nodes)) return [];
  const out: RichNode[] = [];
  for (const n of nodes as RichNode[]) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === 'text' && typeof n.text === 'string' && n.text.length) {
      const marks = cleanMarks(n.marks, allow);
      out.push(marks ? { type: 'text', text: n.text, marks } : { type: 'text', text: n.text });
    } else if (n.type === 'hardBreak') {
      out.push({ type: 'hardBreak' });
    } else if (Array.isArray(n.content)) {
      // an inline piece we do not keep: keep its words
      out.push(...cleanInline(n.content, allow));
    }
  }
  return out;
}

function paragraph(content: RichNode[]): RichNode {
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

/** Blocks, as allowed; a block we do not keep gives up its words as paragraphs. */
function cleanBlocks(nodes: unknown, allow: Allowance, inside: 'doc' | 'callout' | 'item'): RichNode[] {
  if (!Array.isArray(nodes)) return [];
  const out: RichNode[] = [];
  for (const n of nodes as RichNode[]) {
    if (!n || typeof n !== 'object') continue;
    switch (n.type) {
      case 'paragraph':
        out.push(paragraph(cleanInline(n.content, allow)));
        break;
      case 'heading':
        if (allow.heading && inside === 'doc') out.push({ type: 'heading', attrs: { level: 3 }, content: cleanInline(n.content, allow) });
        else out.push(paragraph(cleanInline(n.content, allow)));
        break;
      case 'bulletList':
      case 'orderedList': {
        if (!allow.lists) {
          out.push(...cleanBlocks((n.content ?? []).flatMap((li) => li?.content ?? []), allow, inside));
          break;
        }
        const items = (Array.isArray(n.content) ? n.content : [])
          .filter((li) => li && li.type === 'listItem')
          .map((li) => {
            const inner = cleanBlocks(li.content, allow, 'item');
            return { type: 'listItem', content: inner.length ? inner : [{ type: 'paragraph' }] };
          });
        if (!items.length) break;
        if (n.type === 'orderedList') {
          const start = Number(n.attrs?.start);
          out.push({ type: 'orderedList', attrs: { start: Number.isInteger(start) && start > 0 ? start : 1 }, content: items });
        } else {
          out.push({ type: 'bulletList', content: items });
        }
        break;
      }
      case 'callout': {
        const inner = cleanBlocks(n.content, allow, 'callout');
        if (allow.callout && inside === 'doc') out.push({ type: 'callout', content: inner.length ? inner : [{ type: 'paragraph' }] });
        else out.push(...inner);
        break;
      }
      case 'horizontalRule':
        if (allow.divider && inside === 'doc') out.push({ type: 'horizontalRule' });
        break;
      case 'button': {
        const href = String(n.attrs?.href ?? '').trim();
        const label = String(n.attrs?.label ?? '').replace(/\s+/g, ' ').trim().slice(0, BUTTON_LABEL_MAX);
        if (allow.button && inside === 'doc' && isSafeHref(href) && label) out.push({ type: 'button', attrs: { href, label } });
        break;
      }
      default:
        if (Array.isArray(n.content)) {
          const inline = cleanInline(n.content, allow);
          if (inline.length) out.push(paragraph(inline));
        }
    }
  }
  return out;
}

/** The document as a place's tools allow it; anything else is dropped, its words kept. */
export function cleanDoc(raw: unknown, tools: readonly string[]): RichDoc {
  const doc = raw && typeof raw === 'object' ? (raw as { type?: unknown; content?: unknown }) : null;
  if (!doc || doc.type !== 'doc') return emptyDoc();
  const content = cleanBlocks(doc.content, allowance(tools), 'doc');
  return content.length ? { type: 'doc', content } : emptyDoc();
}

/** A document's words as plain text, a line per block. */
export function docText(doc: RichDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  const lines: string[] = [];
  const inline = (n: RichNode): string =>
    n.type === 'text' ? n.text ?? '' : n.type === 'hardBreak' ? ' ' : (n.content ?? []).map(inline).join('');
  const walk = (nodes: RichNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.type === 'bulletList' || n.type === 'orderedList' || n.type === 'listItem' || n.type === 'callout') walk(n.content);
      else if (n.type === 'button') lines.push(String(n.attrs?.label ?? ''));
      else {
        const t = inline(n).trim();
        if (t) lines.push(t);
      }
    }
  };
  walk(doc.content);
  return lines.join('\n');
}

/** Nothing typed: no words and no Button. */
export function isEmptyDoc(doc: RichDoc | null | undefined): boolean {
  return !docText(doc).trim();
}

/** The words on one line, cut to `max` characters with an ellipsis. */
export function firstLineOf(doc: RichDoc | null | undefined, max = 140): string {
  const text = docText(doc).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
