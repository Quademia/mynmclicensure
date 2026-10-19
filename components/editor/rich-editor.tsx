// components/editor/rich-editor.tsx
//
// The shared rich-text editor (09.13; Sam, 2026-10-19): Tiptap, MyNclex's
// engine at MyNclex's version, with a toolbar the place chooses (`tools`,
// in order, '|' a gap) — the notices take NOTICE_TOOLS (08.14). What is
// typed is what readers see; the document goes up through `onChange` as
// Tiptap's JSON, and the place's save cleans it on the server
// (lib/editor/doc.ts). Link and Button open the shared Link dialog, with
// the app's own pages to pick from when `pages` is given (A4); clicking a
// Button selects it, and the Button tool then changes it. Colours are the
// app's, by name. The editor draws in the browser only; until it is ready
// a plain box of its size stands in.

'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Icon } from '@/components/shell/icons';
import { LinkDialog, type LinkPageGroup } from '@/lib/overlays/shared/link-dialog';
import { isSafeHref } from '@/lib/editor/doc';
import { ButtonBlock, Callout, Marker, Tone } from '@/lib/editor/extensions';
import { MARKER_TONES, TEXT_TONES, type RichDoc, type ToolName } from '@/lib/editor/types';
import type { IconName } from '@/lib/nav/types';
import '@/styles/editor.css';

const TOOL: Record<ToolName, { label: string; icon: IconName; text?: string }> = {
  undo: { label: 'Undo', icon: 'undo' },
  redo: { label: 'Redo', icon: 'redo' },
  bold: { label: 'Bold', icon: 'bold' },
  italic: { label: 'Italic', icon: 'italic' },
  strike: { label: 'Strikethrough', icon: 'strikethrough' },
  superscript: { label: 'Superscript', icon: 'superscript' },
  subscript: { label: 'Subscript', icon: 'subscript' },
  highlight: { label: 'Highlight', icon: 'highlight' },
  color: { label: 'Text colour', icon: 'text-color' },
  subheading: { label: 'Subheading', icon: 'subheading' },
  bulletList: { label: 'Bulleted list', icon: 'list-bulleted' },
  orderedList: { label: 'Numbered list', icon: 'list-numbered' },
  callout: { label: 'Callout box', icon: 'callout' },
  divider: { label: 'Divider line', icon: 'divider' },
  link: { label: 'Link', icon: 'link', text: 'Link' },
  button: { label: 'Button', icon: 'button', text: 'Button' },
  clear: { label: 'Clear formatting', icon: 'clear-formatting' },
};

type Dialog =
  | { kind: 'link'; key: number; href: string; text: string }
  | { kind: 'button'; key: number; href: string; text: string };

export function RichEditor({
  value,
  onChange,
  tools,
  pages,
  placeholder = 'Write here…',
  ariaLabel,
}: {
  /** The document it opens with; later changes to it are not read (the editor keeps its own). */
  value: RichDoc;
  onChange: (doc: RichDoc) => void;
  tools: readonly (ToolName | '|')[];
  /** The app's pages Link and Button may point to (A4). */
  pages?: LinkPageGroup[];
  placeholder?: string;
  ariaLabel: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        underline: false,
        heading: { levels: [3] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => isSafeHref(url),
          HTMLAttributes: { target: null, rel: null },
        },
      }),
      Subscript,
      Superscript,
      Tone,
      Marker,
      Callout,
      ButtonBlock,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: { attributes: { class: 'rt-doc rt-editable', 'aria-label': ariaLabel, 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichDoc),
  });

  if (!editor) {
    return (
      <div className="rte">
        <div className="rte-toolbar rte-toolbar-wait" aria-hidden="true" />
        <div className="rte-body rte-body-wait" aria-hidden="true" />
      </div>
    );
  }
  return <ReadyEditor editor={editor} tools={tools} pages={pages} />;
}

function ReadyEditor({ editor, tools, pages }: { editor: Editor; tools: readonly (ToolName | '|')[]; pages?: LinkPageGroup[] }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      superscript: e.isActive('superscript'),
      subscript: e.isActive('subscript'),
      highlight: e.isActive('marker'),
      color: e.isActive('tone'),
      subheading: e.isActive('heading', { level: 3 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      callout: e.isActive('callout'),
      link: e.isActive('link'),
      button: e.isActive('button'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      marker: (e.getAttributes('marker').tone as string | undefined) ?? null,
      tone: (e.getAttributes('tone').tone as string | undefined) ?? null,
    }),
  });

  const [pop, setPop] = useState<'highlight' | 'color' | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogCount, setDialogCount] = useState(0);
  const popRef = useRef<HTMLDivElement | null>(null);

  // a colour list closes on a click outside it or on Escape
  useEffect(() => {
    if (!pop) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setPop(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPop(null);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pop]);

  function openLink() {
    const { from, to } = editor.state.selection;
    const href = (editor.getAttributes('link').href as string | undefined) ?? '';
    if (href) editor.chain().focus().extendMarkRange('link').run();
    const sel = editor.state.selection;
    const text = editor.state.doc.textBetween(href ? sel.from : from, href ? sel.to : to, ' ');
    setDialogCount((n) => n + 1);
    setDialog({ kind: 'link', key: dialogCount + 1, href: href || 'https://', text });
  }

  function openButton() {
    const node = (editor.state.selection as { node?: { type: { name: string }; attrs: Record<string, unknown> } }).node;
    const current = node && node.type.name === 'button' ? node.attrs : null;
    setDialogCount((n) => n + 1);
    setDialog({ kind: 'button', key: dialogCount + 1, href: String(current?.href || 'https://'), text: String(current?.label || 'Open') });
  }

  function submitDialog({ url, text }: { url: string; text: string }) {
    const d = dialog;
    setDialog(null);
    if (!d) return;
    if (d.kind === 'button') {
      editor.chain().focus().setButton({ href: url, label: text || 'Open' }).run();
      return;
    }
    const words = text || url;
    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text: words, marks: [{ type: 'link', attrs: { href: url } }] })
      .run();
  }

  function run(tool: ToolName) {
    const c = editor.chain().focus();
    switch (tool) {
      case 'undo': return c.undo().run();
      case 'redo': return c.redo().run();
      case 'bold': return c.toggleBold().run();
      case 'italic': return c.toggleItalic().run();
      case 'strike': return c.toggleStrike().run();
      case 'superscript': return c.unsetSubscript().toggleSuperscript().run();
      case 'subscript': return c.unsetSuperscript().toggleSubscript().run();
      case 'subheading': return c.toggleHeading({ level: 3 }).run();
      case 'bulletList': return c.toggleBulletList().run();
      case 'orderedList': return c.toggleOrderedList().run();
      case 'callout': return c.toggleCallout().run();
      case 'divider': return c.setHorizontalRule().run();
      case 'clear': return c.unsetAllMarks().clearNodes().run();
      default: return false;
    }
  }

  const pressed: Partial<Record<ToolName, boolean>> = state;

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        {tools.map((t, i) => {
          if (t === '|') return <span key={`gap-${i}`} className="rte-gap" aria-hidden="true" />;
          const def = TOOL[t];
          const isPop = t === 'highlight' || t === 'color';
          const disabled = (t === 'undo' && !state.canUndo) || (t === 'redo' && !state.canRedo);
          const onClick = () => {
            if (t === 'link') return openLink();
            if (t === 'button') return openButton();
            if (isPop) return setPop((p) => (p === t ? null : t));
            run(t);
          };
          const control = (
            <button
              type="button"
              className={`rte-btn${def.text ? ' rte-btn-text' : ''}${pressed[t] ? ' is-on' : ''}`}
              title={def.label}
              aria-label={def.text ? undefined : def.label}
              aria-pressed={t === 'undo' || t === 'redo' || t === 'divider' || t === 'clear' ? undefined : Boolean(pressed[t])}
              aria-haspopup={isPop ? 'true' : undefined}
              aria-expanded={isPop ? pop === t : undefined}
              disabled={disabled}
              // keep the selection in the writing while a toolbar button is pressed
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClick}
            >
              <Icon name={def.icon} />
              {t === 'color' ? <span className="rte-swatch-line rt-tone" data-tone={state.tone ?? 'none'} aria-hidden="true" /> : null}
              {def.text ? <span>{def.text}</span> : null}
            </button>
          );
          if (!isPop) return <span key={t}>{control}</span>;
          const list = t === 'highlight' ? MARKER_TONES : TEXT_TONES;
          const current = t === 'highlight' ? state.marker : state.tone;
          return (
            <span key={t} className="rte-pop-wrap" ref={pop === t ? popRef : undefined}>
              {control}
              {pop === t ? (
                <span className="rte-pop" role="group" aria-label={def.label}>
                  {list.map((tone) => (
                    <button
                      key={tone.name}
                      type="button"
                      className={`rte-swatch${current === tone.name ? ' is-on' : ''}`}
                      title={tone.label}
                      aria-label={tone.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPop(null);
                        if (t === 'highlight') editor.chain().focus().setMarker(tone.name).run();
                        else editor.chain().focus().setTone(tone.name).run();
                      }}
                    >
                      <span className={t === 'highlight' ? 'rt-marker' : 'rte-swatch-dot rt-tone'} data-marker={t === 'highlight' ? tone.name : undefined} data-tone={t === 'color' ? tone.name : undefined}>
                        {t === 'highlight' ? 'Aa' : null}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rte-swatch-none"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPop(null);
                      if (t === 'highlight') editor.chain().focus().unsetMarker().run();
                      else editor.chain().focus().unsetTone().run();
                    }}
                  >
                    Remove
                  </button>
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      <EditorContent editor={editor} className="rte-body" />
      {dialog ? (
        <LinkDialog
          key={dialog.key}
          open
          title={dialog.kind === 'button' ? 'Button' : 'Link'}
          urlLabel={dialog.kind === 'button' ? 'Button opens:' : 'Link to:'}
          textLabel={dialog.kind === 'button' ? 'Button label:' : 'Link text:'}
          urlDefault={dialog.href}
          textDefault={dialog.text}
          submitLabel={dialog.kind === 'button' ? 'Save button' : 'Save link'}
          pages={pages}
          onSubmit={submitDialog}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
