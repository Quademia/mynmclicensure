// lib/editor/extensions.ts
//
// The shared editor's own pieces (09.13), on top of Tiptap's starter kit:
// text colour and highlight by the app's colour names (the document keeps
// the name, styles/editor.css maps it to a token), the Callout box, and the
// Button — a link drawn as a button on its own line, its address and label
// set through the Link dialog (A4's list of the app's pages). Browser only:
// the editor imports it; the server and the renderer never do.

import { Mark, Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tone: { setTone: (tone: string) => ReturnType; unsetTone: () => ReturnType };
    marker: { setMarker: (tone: string) => ReturnType; unsetMarker: () => ReturnType };
    callout: { toggleCallout: () => ReturnType };
    button: { setButton: (attrs: { href: string; label: string }) => ReturnType };
  }
}

/** Text colour: `<span class="rt-tone" data-tone="red">`. */
export const Tone = Mark.create({
  name: 'tone',
  addAttributes() {
    return {
      tone: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-tone'),
        renderHTML: (attrs: { tone?: string | null }) => (attrs.tone ? { 'data-tone': attrs.tone } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-tone]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'rt-tone' }, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setTone: (tone: string) => ({ commands }) => commands.setMark(this.name, { tone }),
      unsetTone: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

/** Highlight: `<mark class="rt-marker" data-marker="yellow">`. */
export const Marker = Mark.create({
  name: 'marker',
  addAttributes() {
    return {
      tone: {
        default: 'yellow',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-marker') || 'yellow',
        renderHTML: (attrs: { tone?: string | null }) => ({ 'data-marker': attrs.tone || 'yellow' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes({ class: 'rt-marker' }, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setMarker: (tone: string) => ({ commands }) => commands.setMark(this.name, { tone }),
      unsetMarker: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

/** The Callout box: a tinted box around paragraphs or lists. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: '(paragraph|bulletList|orderedList)+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'rt-callout' }), 0];
  },
  addCommands() {
    return {
      toggleCallout: () => ({ commands }) => commands.toggleWrap(this.name),
    };
  },
});

/** The Button: one link drawn as a button, on its own line; selected by a click, changed through the dialog. */
export const ButtonBlock = Node.create({
  name: 'button',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      href: { default: '' },
      label: { default: 'Open' },
    };
  },
  parseHTML() {
    const read = (el: HTMLElement) => {
      const a = el.matches('a') ? el : el.querySelector('a[data-button]');
      return a ? { href: a.getAttribute('href') || '', label: (a.textContent || '').trim() } : false;
    };
    return [
      { tag: 'p.rt-button-row', priority: 60, getAttrs: (el) => read(el as HTMLElement) },
      { tag: 'a[data-button]', priority: 60, getAttrs: (el) => read(el as HTMLElement) },
    ];
  },
  renderHTML({ node }) {
    return [
      'p',
      { class: 'rt-button-row' },
      ['a', { 'data-button': '', href: String(node.attrs.href || ''), class: 'rt-button', contenteditable: 'false' }, String(node.attrs.label || '')],
    ];
  },
  addCommands() {
    return {
      setButton:
        (attrs: { href: string; label: string }) =>
        ({ commands, state }) => {
          const sel = state.selection as { node?: { type: { name: string } } };
          if (sel.node && sel.node.type.name === this.name) return commands.updateAttributes(this.name, attrs);
          return commands.insertContent({ type: this.name, attrs });
        },
    };
  },
});
