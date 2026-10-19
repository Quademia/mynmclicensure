// components/editor/rich-render.tsx
//
// Draws a stored document (09.13) — on the server with the page, or in the
// browser — from the same pieces the editor makes: paragraphs, the
// subheading, both lists, the Callout box, the divider, the Button, and the
// marks (bold, italic, strikethrough, superscript, subscript, highlight,
// text colour, link). No Tiptap and no HTML strings: each piece is drawn by
// React, which escapes every word, and a piece it does not know gives up
// its words only. A link keeps only a safe address (the save checked it
// too); a path inside the app opens in the same tab, anything else in a new
// one. The Button is `a[data-button]`, which a host may listen for (a
// notice counts it as Tapped, announcement-body.tsx). Colours are class and
// data names; styles/editor.css maps them to the app's tokens.

import { Fragment, type ReactNode } from 'react';
import { isAppPath, isSafeHref } from '@/lib/editor/doc';
import type { RichDoc, RichMark, RichNode } from '@/lib/editor/types';
import '@/styles/editor.css';

function linkProps(href: string) {
  return isAppPath(href) ? { href } : { href, target: '_blank', rel: 'noopener noreferrer' };
}

function withMark(el: ReactNode, mark: RichMark, key: string): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong key={key}>{el}</strong>;
    case 'italic':
      return <em key={key}>{el}</em>;
    case 'strike':
      return <s key={key}>{el}</s>;
    case 'superscript':
      return <sup key={key}>{el}</sup>;
    case 'subscript':
      return <sub key={key}>{el}</sub>;
    case 'marker':
      return (
        <mark key={key} className="rt-marker" data-marker={String(mark.attrs?.tone ?? 'yellow')}>
          {el}
        </mark>
      );
    case 'tone':
      return (
        <span key={key} className="rt-tone" data-tone={String(mark.attrs?.tone ?? '')}>
          {el}
        </span>
      );
    case 'link': {
      const href = String(mark.attrs?.href ?? '');
      return isSafeHref(href) ? (
        <a key={key} {...linkProps(href)}>
          {el}
        </a>
      ) : (
        <Fragment key={key}>{el}</Fragment>
      );
    }
    default:
      return <Fragment key={key}>{el}</Fragment>;
  }
}

function Inline({ nodes }: { nodes?: RichNode[] }) {
  if (!nodes?.length) return null;
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === 'hardBreak') return <br key={i} />;
        if (n.type !== 'text' || typeof n.text !== 'string') {
          return n.content ? <Inline key={i} nodes={n.content} /> : null;
        }
        // the link wraps the other marks, so a bold word inside a link stays one link
        const marks = [...(n.marks ?? [])].sort((a, b) => (a.type === 'link' ? 1 : 0) - (b.type === 'link' ? 1 : 0));
        let el: ReactNode = n.text;
        marks.forEach((m, mi) => {
          el = withMark(el, m, `${i}-${mi}`);
        });
        return <Fragment key={i}>{el}</Fragment>;
      })}
    </>
  );
}

function Blocks({ nodes }: { nodes?: RichNode[] }) {
  if (!nodes?.length) return null;
  return <>{nodes.map((n, i) => <Block key={i} node={n} />)}</>;
}

function Block({ node }: { node: RichNode }): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return node.content?.length ? (
        <p>
          <Inline nodes={node.content} />
        </p>
      ) : (
        <p className="rt-empty" aria-hidden="true" />
      );
    case 'heading':
      return (
        <h3 className="rt-subheading">
          <Inline nodes={node.content} />
        </h3>
      );
    case 'bulletList':
      return (
        <ul>
          <Blocks nodes={node.content} />
        </ul>
      );
    case 'orderedList': {
      const start = Number(node.attrs?.start);
      return (
        <ol start={Number.isInteger(start) && start > 1 ? start : undefined}>
          <Blocks nodes={node.content} />
        </ol>
      );
    }
    case 'listItem':
      return (
        <li>
          <Blocks nodes={node.content} />
        </li>
      );
    case 'callout':
      return (
        <div className="rt-callout" data-callout="">
          <Blocks nodes={node.content} />
        </div>
      );
    case 'horizontalRule':
      return <hr className="rt-divider" />;
    case 'button': {
      const href = String(node.attrs?.href ?? '');
      const label = String(node.attrs?.label ?? '');
      if (!isSafeHref(href) || !label) return null;
      return (
        <p className="rt-button-row">
          <a className="rt-button" data-button="" {...linkProps(href)}>
            {label}
          </a>
        </p>
      );
    }
    default:
      return node.content ? <Blocks nodes={node.content} /> : null;
  }
}

/** A stored document drawn read-only; `className` sits beside `rt-doc` on its box. */
export function RichRender({ doc, className }: { doc: RichDoc | null | undefined; className?: string }) {
  if (!doc || !Array.isArray(doc.content)) return null;
  return (
    <div className={className ? `rt-doc ${className}` : 'rt-doc'}>
      <Blocks nodes={doc.content} />
    </div>
  );
}
