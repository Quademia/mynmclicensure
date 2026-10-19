// lib/editor/types.ts
//
// The shared rich-text editor's words (09.13; Sam, 2026-10-19: Tiptap, "we
// can use it for future other things such as the questions"): the shape of
// a stored document (Tiptap's own JSON), the toolbar's tools by name, the
// tools each place gets, and the app's colours a writer may pick. Plain
// constants and types only — no Tiptap, no React — so the server, the
// renderer and the editor all read the same list.

export type RichMark = { type: string; attrs?: Record<string, unknown> };
export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
};
export type RichDoc = { type: 'doc'; content: RichNode[] };

/** Every tool the shared editor knows; a place lists the ones it shows. */
export type ToolName =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'superscript'
  | 'subscript'
  | 'highlight'
  | 'color'
  | 'subheading'
  | 'bulletList'
  | 'orderedList'
  | 'callout'
  | 'divider'
  | 'link'
  | 'button'
  | 'clear';

/** The notices' toolbar, in its order; '|' is a gap between groups (08.14; Sam, 2026-10-19). */
export const NOTICE_TOOLS: readonly (ToolName | '|')[] = [
  'undo', 'redo', '|',
  'bold', 'italic', 'strike', 'superscript', 'subscript', '|',
  'highlight', 'color', '|',
  'subheading', 'bulletList', 'orderedList', 'callout', 'divider', '|',
  'link', 'button', '|',
  'clear',
];

/**
 * The colours a writer may pick, by name — the document keeps the name,
 * never a colour value, and styles/editor.css maps each to one of the
 * app's own tokens, so a notice follows the app's colours (and dark mode,
 * 09.4, when it comes). Text colours are the badge inks, which read on
 * white; highlights are the badge edges, pale enough for text on top.
 */
export const TEXT_TONES = [
  { name: 'red', label: 'Red' },
  { name: 'amber', label: 'Amber' },
  { name: 'green', label: 'Green' },
  { name: 'blue', label: 'Blue' },
  { name: 'teal', label: 'Teal' },
  { name: 'navy', label: 'Navy' },
  { name: 'purple', label: 'Purple' },
  { name: 'grey', label: 'Grey' },
] as const;

export const MARKER_TONES = [
  { name: 'yellow', label: 'Yellow' },
  { name: 'green', label: 'Green' },
  { name: 'blue', label: 'Blue' },
  { name: 'pink', label: 'Pink' },
  { name: 'red', label: 'Red' },
  { name: 'purple', label: 'Purple' },
] as const;

export type TextTone = (typeof TEXT_TONES)[number]['name'];
export type MarkerTone = (typeof MARKER_TONES)[number]['name'];

/** The longest label a Button may carry. */
export const BUTTON_LABEL_MAX = 60;
