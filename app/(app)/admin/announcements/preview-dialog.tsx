// app/(app)/admin/announcements/preview-dialog.tsx
//
// The editor page's Preview (08.18; Sam, 2026-10-19): the notice as a
// student sees it on a phone — in their list (the square, the title in
// blue while new, the first line, "now"), opened (the picture across the
// top, kind · date, the words, the Button, "I've read this" when it asks),
// and, when Must-see is on, the dashboard's pop-up. Three tabs in the
// shared dialog. What is on the page now, saved or not; nothing is sent
// or marked. Only used here.

'use client';

import { useState } from 'react';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { Icon } from '@/components/shell/icons';
import { RichRender } from '@/components/editor/rich-render';
import { firstLineOf } from '@/lib/editor/doc';
import type { RichDoc } from '@/lib/editor/types';
import type { IconName } from '@/lib/nav/types';

export type PreviewNotice = {
  title: string;
  kind: string;
  icon: IconName;
  body: RichDoc;
  fullUrl: string | null;
  listUrl: string | null;
  askConfirm: boolean;
  mustSee: boolean;
  date: string;
};

type Tab = 'list' | 'opened' | 'mustsee';

export function PreviewDialog({ open, onClose, notice }: { open: boolean; onClose: () => void; notice: PreviewNotice }) {
  const [tab, setTab] = useState<Tab>('opened');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'list', label: 'In their list' },
    { key: 'opened', label: 'Opened' },
    ...(notice.mustSee ? [{ key: 'mustsee' as const, label: 'Must-see pop-up' }] : []),
  ];
  const shown = tabs.some((t) => t.key === tab) ? tab : 'opened';
  const title = notice.title.trim() || 'Your title';

  return (
    <Dialog open={open} onClose={onClose} title="Preview: as a student sees it" wide>
      <p className="dlg-text pv-note">What is on the page now, saved or not. Nothing is sent or marked.</p>
      <div className="pv-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={shown === t.key} className={`pv-tab${shown === t.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="pv-phone">
        {shown === 'list' ? (
          <div className="pv-row">
            <span className="pv-dot" aria-hidden="true" />
            {notice.listUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the list's square, as students get it
              <img className="pv-square" src={notice.listUrl} alt="" />
            ) : (
              <span className="pv-square pv-square-icon"><Icon name={notice.icon} size={20} /></span>
            )}
            <span className="pv-row-main">
              <span className="pv-row-top">
                <span className="pv-row-title">{title}</span>
                <span className="pv-row-when">now</span>
              </span>
              <span className="pv-row-line">{firstLineOf(notice.body, 90)}</span>
            </span>
          </div>
        ) : null}
        {shown === 'opened' ? (
          <div className="pv-open">
            {notice.fullUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the opened notice's size
              <img className="pv-media" src={notice.fullUrl} alt="" />
            ) : null}
            <div className="pv-open-body">
              <p className="pv-meta"><Icon name={notice.icon} size={13} />{notice.kind} · {notice.date}</p>
              <h3 className="pv-title">{title}</h3>
              <div className="sann-body"><RichRender doc={notice.body} /></div>
              {notice.askConfirm ? <span className="btn btn-outline pv-confirm">I&apos;ve read this</span> : null}
              <span className="pv-ask">Ask about this</span>
            </div>
          </div>
        ) : null}
        {shown === 'mustsee' ? (
          <div className="pv-mustsee">
            <div className="pv-popup">
              {notice.fullUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the pop-up's picture
                <img className="pv-media" src={notice.fullUrl} alt="" />
              ) : null}
              <div className="pv-open-body">
                <h3 className="pv-title">{title}</h3>
                <p className="pv-meta"><Icon name={notice.icon} size={13} />{notice.kind} · {notice.date}</p>
                <div className="mustsee-body"><RichRender doc={notice.body} /></div>
                <div className="pv-popup-actions">
                  <span className="btn btn-ghost">Later</span>
                  <span className="btn btn-primary">I&apos;ve read this</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="dlg-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>Back to editing</button>
      </div>
    </Dialog>
  );
}
