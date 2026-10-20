// app/(app)/admin/announcements/announcements-client.tsx
//
// The admin's announcements list (08.17; Sam, 2026-10-19 — layout A,
// mocked up and approved 2026-10-20). Tabs by state with their counts —
// Live · Scheduled · Drafts · Ended (an archived notice labelled inside
// Ended) — in place of the five count boxes and the status filter; a search
// by title; Kinds and + New announcement. A quiet row per notice: the
// kind's icon, the title (Must-see and Pinned marked), who and when on one
// small line, Seen out of who it reaches today as a bar, then Read (when
// it asks to confirm) or Tapped, and the row menu (09.10): Edit,
// Follow-up, Archive. A tap on the row opens the notice's own page (08.18);
// on the numbers, the Follow-up panel (08.11). On a phone a row stacks and
// the tabs wrap — the one that is on never slides out of sight.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { RowMenu, type RowMenuItem } from '@/components/shell/row-menu';
import { archiveAnnouncement } from '@/lib/announcements/actions';
import { kindIcon, longWhen, pictureUrl } from '@/lib/announcements/display';
import type { AnnouncementKind, AnnouncementRow, DisplayStatus, EngageMap, ReachMap } from '@/lib/announcements/types';
import { KindsPanel } from './kinds-panel';
import { FollowUpPanel } from './followup-panel';

type Notice = AnnouncementRow & { display: DisplayStatus };
type Tab = 'live' | 'scheduled' | 'drafts' | 'ended';
type Msg = { text: string; tone: 'error' | 'success' } | null;

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'live', label: 'Live', empty: 'No notice is live.' },
  { key: 'scheduled', label: 'Scheduled', empty: 'Nothing is scheduled.' },
  { key: 'drafts', label: 'Drafts', empty: 'No drafts.' },
  { key: 'ended', label: 'Ended', empty: 'Nothing has ended yet.' },
];

function tabOf(d: DisplayStatus): Tab {
  if (d === 'active') return 'live';
  if (d === 'scheduled') return 'scheduled';
  if (d === 'draft') return 'drafts';
  return 'ended';
}

const KIND_WORD: Record<string, string> = { PAID: 'Paid', TRIAL: 'On a trial', FREE: 'Free' };

/** Who it is for, in a few words: "RN · Paid", "Every student". */
function whoWords(a: AnnouncementRow): string {
  const parts: string[] = [];
  if (a.scope_programs?.length) parts.push(a.scope_programs.join(', '));
  if (a.scope_subscription_kind) parts.push(KIND_WORD[a.scope_subscription_kind] ?? a.scope_subscription_kind);
  if (a.scope_courses?.length) parts.push(a.scope_courses.length === 1 ? '1 course' : `${a.scope_courses.length} courses`);
  if (a.scope_level?.length) parts.push(a.scope_level.join(', '));
  if (a.scope_product_ids?.length) parts.push(a.scope_product_ids.length === 1 ? '1 package' : `${a.scope_product_ids.length} packages`);
  if (a.scope_cohort) parts.push(`cohort ${a.scope_cohort}`);
  if (a.scope_user_ids?.length) parts.push(a.scope_user_ids.length === 1 ? '1 named student' : `${a.scope_user_ids.length} named students`);
  return parts.length ? parts.join(' · ') : 'Every student';
}

function whenWords(a: Notice): string {
  switch (a.display) {
    case 'active':
      return `since ${longWhen(a.start_at || a.created_at)}${a.end_at ? `, ends ${longWhen(a.end_at)}` : ''}`;
    case 'scheduled':
      return `starts ${longWhen(a.start_at)}`;
    case 'draft':
      return `made ${longWhen(a.created_at)}`;
    case 'expired':
      return `ended ${longWhen(a.end_at)}`;
    default:
      return a.start_at || a.created_at ? `from ${longWhen(a.start_at || a.created_at)}` : '';
  }
}

export function AnnouncementsClient({
  notices,
  engage,
  reach,
  kinds,
}: {
  notices: Notice[];
  engage: EngageMap;
  reach: ReachMap;
  kinds: AnnouncementKind[];
}) {
  const router = useRouter();
  const [confirm, confirmEl] = useConfirm();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);
  const err = (text: string) => setMsg({ text, tone: 'error' });
  const ok = (text: string) => setMsg({ text, tone: 'success' });

  const counts: Record<Tab, number> = { live: 0, scheduled: 0, drafts: 0, ended: 0 };
  for (const a of notices) counts[tabOf(a.display)] += 1;
  const [tab, setTab] = useState<Tab>(counts.live || (!counts.drafts && !counts.scheduled) ? 'live' : counts.drafts ? 'drafts' : 'scheduled');
  const [search, setSearch] = useState('');
  const q = search.toLowerCase().trim();
  const shown = notices.filter((a) => tabOf(a.display) === tab && (!q || a.title.toLowerCase().includes(q)));

  const iconOf = new Map(kinds.map((k) => [k.name, k.icon]));
  const usedBy: Record<string, number> = {};
  for (const a of notices) usedBy[a.kind] = (usedBy[a.kind] ?? 0) + 1;

  const [kindsOpen, setKindsOpen] = useState(false);
  const [follow, setFollow] = useState<{ announcement_id: string; title: string; when: string; askConfirm: boolean } | null>(null);
  const openFollow = (a: Notice) =>
    setFollow({ announcement_id: a.announcement_id, title: a.title, when: `made ${longWhen(a.created_at)}`, askConfirm: Boolean(a.ask_confirm) });

  async function archive(a: Notice) {
    const yes = await confirm({
      title: 'Archive this notice?',
      body: `"${a.title}" will no longer be visible to students. You can bring it back from its page with Restore to drafts.`,
      confirmLabel: 'Archive',
      danger: true,
    });
    if (!yes) return;
    try {
      const r = await archiveAnnouncement(a.announcement_id);
      if (!r.ok) return err(r.error);
      ok('Archived.');
      router.refresh();
    } catch {
      err('Could not archive. Please check your connection and try again.');
    }
  }

  return (
    <div className="ann">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />
      {confirmEl}

      <div className="ann-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setKindsOpen(true)}>Kinds</button>
        <AppLink href="/admin/announcements/new" className="btn btn-primary">
          <Icon name="megaphone" />
          New announcement
        </AppLink>
      </div>

      <div className="ann-bar">
        <div className="ann-tabs" role="tablist" aria-label="Announcements by state">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ann-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="ann-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <label className="ann-search">
          <span className="ann-sr">Search titles</span>
          <Icon name="search" />
          <input type="search" placeholder="Search titles…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <div className="card ann-list">
        {shown.length ? (
          shown.map((a) => {
            const ec = engage[a.announcement_id] ?? { seen: 0, tapped: 0, dismissed: 0, confirmed: 0 };
            const r = reach[a.announcement_id] ?? 0;
            const counted = a.display !== 'draft' && a.display !== 'scheduled';
            const items: RowMenuItem[] = [
              { type: 'link', label: 'Edit', href: `/admin/announcements/${encodeURIComponent(a.announcement_id)}`, icon: 'pencil' },
              ...(counted ? [{ type: 'button' as const, label: 'Follow-up', icon: 'chart' as const, onSelect: () => openFollow(a) }] : []),
              ...(a.display !== 'archived' ? [{ type: 'button' as const, label: 'Archive…', icon: 'inbox' as const, danger: true, onSelect: () => void archive(a) }] : []),
            ];
            const square = pictureUrl(a.picture_path, 'list');
            return (
              <div key={a.announcement_id} className="ann-row">
                {/* the picture's square when there is one, as students' list draws it; else the kind's icon */}
                <span className={`ann-kind-square${square ? ' has-picture' : ''}`} aria-hidden="true">
                  {square ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the list's 160px square, made at upload
                    <img src={square} alt="" loading="lazy" />
                  ) : (
                    <Icon name={kindIcon(iconOf.get(a.kind))} size={18} />
                  )}
                </span>
                <AppLink href={`/admin/announcements/${encodeURIComponent(a.announcement_id)}`} className="ann-row-main">
                  <span className="ann-row-title">
                    <span className="ann-row-name">{a.title}</span>
                    {a.must_see ? <span className="badge badge-warning">Must-see</span> : null}
                    {a.pinned ? <span className="badge badge-info">Pinned</span> : null}
                    {a.display === 'archived' ? <span className="badge badge-neutral">Archived</span> : null}
                  </span>
                  <span className="ann-row-meta">{whoWords(a)} · {whenWords(a)}</span>
                </AppLink>
                {counted ? (
                  <button type="button" className="ann-row-nums" title="Open Follow-up" onClick={() => openFollow(a)}>
                    <span className="ann-row-seen">
                      <span>Seen by {ec.seen} of {r}</span>
                      <span className="ann-bar-track" aria-hidden="true">
                        <span className="ann-bar-fill" style={{ width: `${r > 0 ? Math.min(100, Math.round((ec.seen / r) * 100)) : 0}%` }} />
                      </span>
                    </span>
                    <span className="ann-row-second">{a.ask_confirm ? `Read ${ec.confirmed}` : `Tapped ${ec.tapped}`}</span>
                  </button>
                ) : (
                  <span className="ann-row-wait">{a.display === 'scheduled' ? `Will reach ${r} today` : 'Not published'}</span>
                )}
                <RowMenu label={`More for ${a.title}`} items={items} />
              </div>
            );
          })
        ) : (
          <div className="ann-empty">
            <p>{q ? 'No notice here matches that title.' : TABS.find((t) => t.key === tab)?.empty}</p>
            {!q ? (
              <AppLink href="/admin/announcements/new" className="btn-link">+ New announcement</AppLink>
            ) : null}
          </div>
        )}
      </div>

      <BodyPortal>
        <div className="ann-overlay">
          <KindsPanel open={kindsOpen} onClose={() => setKindsOpen(false)} kinds={kinds} usedBy={usedBy} onError={err} onDone={ok} />
          <FollowUpPanel notice={follow} onClose={() => setFollow(null)} />
        </div>
      </BodyPortal>
    </div>
  );
}
