// app/(app)/admin/announcements/notice-editor.tsx
//
// The notice's own page (08.18; Sam, 2026-10-19 — layout A, mocked up and
// approved 2026-10-20), shared by a new notice (/new) and each notice
// (/[id]). The message on the left — title, kind (Edit kinds opens the
// Kinds panel), the words in the shared editor with the notices' toolbar
// (08.14), the picture (08.10) — and the settings in a column on the
// right, under the message on a phone: Who sees it (chips, + Narrow down,
// the reach line), When, How it shows (each switch with its hint).
//
// The buttons follow the notice's state, the Status dropdown gone: a new
// notice or a draft — Save draft · Publish (Schedule, when it starts
// later); live or scheduled — Save changes and ⋯ with Move to drafts and
// Archive; ended or archived — Restore to drafts. Every one saves what is
// on the page with the status it means; Publish and Schedule ask once,
// naming who it reaches; Move to drafts and Archive ask too. Preview shows
// the student's view. Leaving with unsaved changes asks first — a link in
// the app or closing the tab. Send to phones comes with 08.15.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { RichEditor } from '@/components/editor/rich-editor';
import { docText, emptyDoc } from '@/lib/editor/doc';
import { NOTICE_TOOLS, type RichDoc } from '@/lib/editor/types';
import { removeAnnouncementPicture, saveAnnouncement, setAnnouncementPicture } from '@/lib/announcements/actions';
import { previewReach } from '@/lib/announcements/followup-actions';
import { appPageGroups } from '@/lib/announcements/app-pages';
import { kindIcon, longWhen, pictureUrl } from '@/lib/announcements/display';
import { makePicture, type MadePicture } from '@/lib/announcements/picture-maker';
import { DEFAULT_KIND, type Announcement, type DisplayStatus } from '@/lib/announcements/types';
import type { EditorChoices } from '@/lib/announcements/queries';
import { KindsPanel } from './kinds-panel';
import { FollowUpPanel } from './followup-panel';
import { PreviewDialog } from './preview-dialog';
import { WhoSeesIt, type Scopes } from './who-sees-it';

type Msg = { text: string; tone: 'error' | 'success' } | null;
type NewPicture = MadePicture & { fullUrl: string; listUrl: string };

const LIST = '/admin/announcements';

/** The clock, read in a handler or a state's first value, never in render (AGENTS.md). */
function clockNow(): number {
  return Date.now();
}

/** A stored time as the date box's local "YYYY-MM-DDTHH:mm". */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The date box's local time as a stored one; '' for none. */
function fromLocalInput(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function whenWords(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function NoticeEditor({
  notice,
  display,
  seen,
  initialUsers,
  choices,
  usedBy,
}: {
  notice: Announcement | null;
  /** The notice's state now; null for a new one. */
  display: DisplayStatus | null;
  /** Seen out of who it reaches today, for a live notice's line. */
  seen: { seen: number; reach: number } | null;
  initialUsers: { user_id: string; name: string }[];
  choices: EditorChoices;
  usedBy: Record<string, number>;
}) {
  const router = useRouter();
  const [confirm, confirmEl] = useConfirm();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);
  const err = (text: string) => setMsg({ text, tone: 'error' });
  const ok = (text: string) => setMsg({ text, tone: 'success' });
  const [openedAt] = useState(clockNow);

  const { programs, courses, products, cohorts, kinds, mocks } = choices;
  const firstKind = kinds.find((k) => k.active && k.name === DEFAULT_KIND)?.name ?? kinds.find((k) => k.active)?.name ?? DEFAULT_KIND;

  // ── the form, from the notice ──
  const [title, setTitle] = useState(notice?.title ?? '');
  const [kind, setKind] = useState(notice?.kind ?? firstKind);
  const [initialBody] = useState<RichDoc>(() => notice?.body ?? emptyDoc());
  const [body, setBody] = useState<RichDoc>(initialBody);
  const [startOn, setStartOn] = useState(Boolean(notice?.start_at));
  const [startAt, setStartAt] = useState(toLocalInput(notice?.start_at ?? null));
  const [endOn, setEndOn] = useState(Boolean(notice?.end_at));
  const [endAt, setEndAt] = useState(toLocalInput(notice?.end_at ?? null));
  const [mustSee, setMustSee] = useState(Boolean(notice?.must_see));
  const [askConfirm, setAskConfirm] = useState(Boolean(notice?.ask_confirm));
  const [pinned, setPinned] = useState(Boolean(notice?.pinned));
  const [dismissible, setDismissible] = useState(notice ? Boolean(notice.dismissible) : true);
  const [priority, setPriority] = useState(String(notice?.priority ?? 1));
  const [scopes, setScopes] = useState<Scopes>({
    programs: notice?.scope_programs ?? [],
    courses: notice?.scope_courses ?? [],
    levels: notice?.scope_level ?? [],
    subKind: notice?.scope_subscription_kind ?? '',
    products: notice?.scope_product_ids ?? [],
    cohort: notice?.scope_cohort ?? '',
    users: initialUsers,
  });

  // ── the picture (08.10): made small here, sent after the notice saves ──
  const currentPicture = notice?.picture_path ?? null;
  const [newPicture, setNewPicture] = useState<NewPicture | null>(null);
  const [dropPicture, setDropPicture] = useState(false);
  const [makingPicture, setMakingPicture] = useState(false);
  const pictureInput = useRef<HTMLInputElement | null>(null);

  async function choosePicture(file: File | undefined) {
    if (!file) return;
    setMakingPicture(true);
    try {
      const made = await makePicture(file);
      setNewPicture((p) => {
        if (p) {
          URL.revokeObjectURL(p.fullUrl);
          URL.revokeObjectURL(p.listUrl);
        }
        return { ...made, fullUrl: URL.createObjectURL(made.full), listUrl: URL.createObjectURL(made.list) };
      });
      setDropPicture(false);
    } catch (e) {
      err(e instanceof Error && e.message === 'too big' ? 'That file is too big (over 15 MB).' : 'That file could not be read as a picture. Please choose a JPEG, PNG or WebP picture.');
    } finally {
      setMakingPicture(false);
      if (pictureInput.current) pictureInput.current.value = '';
    }
  }

  function removePicture() {
    setNewPicture((p) => {
      if (p) {
        URL.revokeObjectURL(p.fullUrl);
        URL.revokeObjectURL(p.listUrl);
      }
      return null;
    });
    setDropPicture(true);
  }

  const showFull = newPicture ? newPicture.fullUrl : currentPicture && !dropPicture ? pictureUrl(currentPicture, 'full') : null;
  const showList = newPicture ? newPicture.listUrl : currentPicture && !dropPicture ? pictureUrl(currentPicture, 'list') : null;

  // ── unsaved changes ──
  const snapshot = JSON.stringify([title, kind, body, startOn, startAt, endOn, endAt, mustSee, askConfirm, pinned, dismissible, priority, scopes, Boolean(newPicture), dropPicture]);
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot !== baseline;

  // Leaving asks first: closing or reloading the tab, or a link in the app
  // (caught before the app's router sees the click).
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      if (a.closest('.rte, .ann-ed-keep')) return;
      e.preventDefault();
      e.stopPropagation();
      void confirm({
        title: 'Leave without saving?',
        body: 'Your changes to this notice are not saved.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      }).then((yes) => {
        if (yes) {
          window.removeEventListener('beforeunload', onBeforeUnload);
          router.push(href);
        }
      });
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, confirm, router]);

  // ── the reach line (08.12): counted a moment after the scopes stop changing ──
  const scopeKey = JSON.stringify([scopes.programs, scopes.courses, scopes.levels, scopes.subKind, scopes.products, scopes.users.map((u) => u.user_id), scopes.cohort]);
  const [reachCount, setReachCount] = useState<{ key: string; n: number } | null>(null);
  const reach = reachCount && reachCount.key === scopeKey ? reachCount.n : null;
  useEffect(() => {
    let stopped = false;
    const [pr, co, lv, sk, pd, us, ch] = JSON.parse(scopeKey) as [string[], string[], string[], string, string[], string[], string];
    const timer = window.setTimeout(() => {
      previewReach({
        scope_programs: pr,
        scope_courses: co,
        scope_levels: lv,
        scope_subscription_kind: sk,
        scope_product_ids: pd,
        scope_user_ids: us,
        scope_cohort: ch,
      })
        .then((n) => {
          if (!stopped && n != null) setReachCount({ key: scopeKey, n });
        })
        .catch(() => {});
    }, 400);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [scopeKey]);

  // ── saving ──
  const [busy, setBusy] = useState<string | null>(null);
  const state: 'draft' | 'live' | 'ended' = !display || display === 'draft' ? 'draft' : display === 'active' || display === 'scheduled' ? 'live' : 'ended';
  const startsLater = startOn && Boolean(startAt) && new Date(startAt).getTime() > openedAt;
  const chars = docText(body).length;

  async function save(status: 'draft' | 'active' | 'archived', doneWords: string): Promise<boolean> {
    if (!title.trim()) {
      err('Give the notice a title first.');
      return false;
    }
    if (startOn && !startAt) {
      err('Pick when it starts, or set Starts to Now.');
      return false;
    }
    if (endOn && !endAt) {
      err('Pick when it ends, or set Ends to No end.');
      return false;
    }
    const result = await saveAnnouncement({
      announcement_id: notice?.announcement_id ?? null,
      title: title.trim(),
      // a plain copy: the editor's objects do not all survive the trip (AGENTS.md)
      body: JSON.parse(JSON.stringify(body)) as RichDoc,
      status,
      priority: Number.parseInt(priority, 10) || 1,
      pinned,
      dismissible,
      must_see: mustSee,
      ask_confirm: askConfirm || mustSee,
      kind,
      scope_subscription_kind: scopes.subKind,
      scope_cohort: scopes.cohort,
      scope_programs: scopes.programs,
      scope_courses: scopes.courses,
      scope_levels: scopes.levels,
      scope_product_ids: scopes.products,
      scope_user_ids: scopes.users.map((u) => u.user_id),
      start_at: startOn ? fromLocalInput(startAt) : '',
      end_at: endOn ? fromLocalInput(endAt) : '',
    });
    if (!result.ok) {
      err(result.error);
      return false;
    }
    const id = result.announcement_id;
    // the picture goes once the notice is saved: it needs the notice's id
    if (newPicture) {
      const form = new FormData();
      form.set('announcement_id', id);
      form.set('ext', newPicture.ext);
      const type = newPicture.ext === 'jpg' ? 'image/jpeg' : 'image/webp';
      form.set('full', new File([newPicture.full], `full.${newPicture.ext}`, { type }));
      form.set('list', new File([newPicture.list], `list.${newPicture.ext}`, { type }));
      const pic = await setAnnouncementPicture(form);
      if (!pic.ok) err(`Saved, but: ${pic.error}`);
    } else if (dropPicture && currentPicture) {
      const gone = await removeAnnouncementPicture(id);
      if (!gone.ok) err(`Saved, but: ${gone.error}`);
    }
    setBaseline(snapshot);
    ok(doneWords);
    if (result.created) router.replace(`${LIST}/${encodeURIComponent(id)}`);
    else router.refresh();
    return true;
  }

  async function run(label: string, status: 'draft' | 'active' | 'archived', doneWords: string) {
    setBusy(label);
    try {
      await save(status, doneWords);
    } catch {
      // a dropped connection rejects (AGENTS.md); the page keeps what was typed
      err('Could not save. Please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!title.trim()) return err('Give the notice a title first.');
    const who = reach === null ? 'the students it reaches' : `${reach} student${reach === 1 ? '' : 's'}`;
    const asks = askConfirm || mustSee ? " They'll be asked to confirm they've read it." : '';
    const popup = mustSee ? ' As Must-see, it pops up on their dashboard until they press "I\'ve read this".' : '';
    const yes = await confirm(
      startsLater
        ? {
            title: `Schedule for ${whenWords(startAt)}, to ${who}?`,
            body: `"${title.trim()}" shows on their Announcements page from then.${asks}${popup}`,
            confirmLabel: 'Schedule',
          }
        : {
            title: `Publish to ${who}?`,
            body: `"${title.trim()}" shows on their Announcements page now.${asks}${popup}`,
            confirmLabel: 'Publish',
          },
    );
    if (yes) await run('publish', 'active', startsLater ? 'Scheduled.' : 'Published.');
  }

  async function moveToDrafts() {
    const yes = await confirm({
      title: 'Move to drafts?',
      body: 'Students stop seeing it until you publish it again. Their marks on it are kept.',
      confirmLabel: 'Move to drafts',
    });
    if (yes) await run('drafts', 'draft', 'Moved to drafts.');
  }

  async function archive() {
    const yes = await confirm({
      title: 'Archive this notice?',
      body: `"${title.trim() || 'This notice'}" will no longer be visible to students. You can bring it back with Restore to drafts.`,
      confirmLabel: 'Archive',
      danger: true,
    });
    if (yes) await run('archive', 'archived', 'Archived.');
  }

  // ── the menus and panels ──
  const [more, setMore] = useState(false);
  const [kindsOpen, setKindsOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!more) return;
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMore(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [more]);

  const kindRow = kinds.find((k) => k.name === kind);
  const badge =
    !display || display === 'draft'
      ? { word: 'Draft', tone: 'neutral' }
      : display === 'active'
        ? { word: 'Live', tone: 'success' }
        : display === 'scheduled'
          ? { word: 'Scheduled', tone: 'info' }
          : display === 'expired'
            ? { word: 'Ended', tone: 'neutral' }
            : { word: 'Archived', tone: 'neutral' };
  const meta = !notice
    ? 'Not saved yet'
    : display === 'active'
      ? `Since ${longWhen(notice.start_at || notice.created_at)}${seen ? ` · seen by ${seen.seen} of ${seen.reach}` : ''}`
      : display === 'scheduled'
        ? `Starts ${whenWords(toLocalInput(notice.start_at))}`
        : display === 'expired'
          ? `Ended ${longWhen(notice.end_at)} · students no longer see it`
          : display === 'archived'
            ? 'Students no longer see it'
            : dirty
              ? 'Changes not saved'
              : 'Saved';

  return (
    <div className="ann-ed">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />
      {confirmEl}

      <div className="ann-ed-top">
        <AppLink href={LIST} className="ann-back">
          <Icon name="chevron-left" />
          Announcements
        </AppLink>
        <span className={`badge badge-${badge.tone}`}>{badge.word}</span>
        <span className="ann-ed-meta">{notice && dirty && state !== 'draft' ? 'Changes not saved' : meta}</span>
        {state === 'live' && notice ? (
          <button type="button" className="btn-link" onClick={() => setFollowOpen(true)}>Follow-up</button>
        ) : null}
        <span className="ann-ed-grow" />
        <button type="button" className="btn btn-ghost" onClick={() => setPreviewOpen(true)}>
          <Icon name="eye" />
          Preview
        </button>
        {state === 'draft' ? (
          <>
            <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={() => void run('save', 'draft', 'Draft saved.')}>
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </button>
            <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void publish()}>
              {busy === 'publish' ? (startsLater ? 'Scheduling…' : 'Publishing…') : startsLater ? 'Schedule' : 'Publish'}
            </button>
          </>
        ) : null}
        {state === 'live' ? (
          <>
            <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void run('save', 'active', 'Changes saved.')}>
              {busy === 'save' ? 'Saving…' : 'Save changes'}
            </button>
            <div className="ann-more" ref={moreRef}>
              <button type="button" className="btn btn-ghost ann-more-btn" aria-label="More" aria-expanded={more} disabled={Boolean(busy)} onClick={() => setMore((m) => !m)}>
                <Icon name="dots" />
              </button>
              {more ? (
                <div className="ann-more-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMore(false); void moveToDrafts(); }}>Move to drafts</button>
                  <button type="button" role="menuitem" className="danger" onClick={() => { setMore(false); void archive(); }}>Archive…</button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {state === 'ended' ? (
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void run('restore', 'draft', 'Restored to drafts.')}>
            {busy === 'restore' ? 'Restoring…' : 'Restore to drafts'}
          </button>
        ) : null}
      </div>

      <div className="ann-ed-grid">
        <section className="card ann-ed-msg" aria-label="The message">
          <label className="ann-field">
            <span className="ann-label">Title</span>
            <input className="ann-input ann-title" type="text" maxLength={200} placeholder="Mock exam 2 opens Saturday" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div className="ann-kind-row">
            <label className="ann-field">
              <span className="ann-label">Kind</span>
              <span className="ann-kind">
                <span className="ann-kind-square" aria-hidden="true"><Icon name={kindIcon(kindRow?.icon)} size={20} /></span>
                <select className="ann-input" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {kinds
                    .filter((k) => k.active || k.name === kind)
                    .map((k) => (
                      <option key={k.name} value={k.name}>{k.name}{k.active ? '' : ' (retired)'}</option>
                    ))}
                </select>
              </span>
            </label>
            <button type="button" className="btn-link ann-kinds-link" onClick={() => setKindsOpen(true)}>Edit kinds</button>
          </div>

          <div className="ann-field">
            <span className="ann-label" id="ann-words">The words</span>
            <RichEditor value={initialBody} onChange={setBody} tools={NOTICE_TOOLS} pages={appPageGroups(courses, mocks)} placeholder="Write the notice here…" ariaLabel="The words" />
            <span className={`ann-count${chars > 800 ? ' is-over' : chars > 500 ? ' is-long' : ''}`}>{chars} character{chars === 1 ? '' : 's'}</span>
          </div>

          <div className="ann-field">
            <span className="ann-label">Picture <span className="ann-optional">(optional)</span></span>
            {showFull ? (
              <div className="ann-pics">
                {/* eslint-disable-next-line @next/next/no-img-element -- the opened notice's size, made at upload */}
                <img className="ann-pic-full" src={showFull} alt="The picture as students see it opened" />
                {/* eslint-disable-next-line @next/next/no-img-element -- the list's square */}
                {showList ? <img className="ann-pic-list" src={showList} alt="The list's square" /> : null}
              </div>
            ) : null}
            <input ref={pictureInput} className="ann-file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={(e) => void choosePicture(e.target.files?.[0])} />
            <div className="ann-pic-actions">
              <button type="button" className="btn btn-ghost btn-sm" disabled={makingPicture} onClick={() => pictureInput.current?.click()}>
                {makingPicture ? 'Making it smaller…' : showFull ? 'Replace picture' : 'Choose a picture'}
              </button>
              {showFull ? <button type="button" className="btn-link danger" onClick={removePicture}>Remove</button> : null}
            </div>
            <p className="ann-hint">
              Wide, about 1200 × 600: the middle is kept at that shape, and the list shows its middle square. It is made smaller on this computer before it is sent
              {newPicture ? ` (${Math.max(1, Math.round(newPicture.full.size / 1024))} KB and ${Math.max(1, Math.round(newPicture.list.size / 1024))} KB), with the next save.` : '.'}
              {dropPicture && currentPicture ? ' The picture goes with the next save.' : ''}
            </p>
          </div>
        </section>

        <aside className="card ann-ed-set" aria-label="Settings">
          <div className="ann-set-group">
            <h2 className="ann-set-title">Who sees it</h2>
            <WhoSeesIt value={scopes} onChange={setScopes} programs={programs} courses={courses} products={products} cohorts={cohorts} reach={reach} />
          </div>

          <div className="ann-set-group">
            <h2 className="ann-set-title">When</h2>
            <div className="ann-when">
              <label className="ann-when-row">
                <span>Starts</span>
                <select className="ann-input" value={startOn ? 'date' : 'now'} onChange={(e) => setStartOn(e.target.value === 'date')}>
                  <option value="now">Now</option>
                  <option value="date">On a date…</option>
                </select>
              </label>
              {startOn ? <input className="ann-input" type="datetime-local" aria-label="Starts on" value={startAt} onChange={(e) => setStartAt(e.target.value)} /> : null}
              <label className="ann-when-row">
                <span>Ends</span>
                <select className="ann-input" value={endOn ? 'date' : 'never'} onChange={(e) => setEndOn(e.target.value === 'date')}>
                  <option value="never">No end</option>
                  <option value="date">On a date…</option>
                </select>
              </label>
              {endOn ? <input className="ann-input" type="datetime-local" aria-label="Ends on" value={endAt} onChange={(e) => setEndAt(e.target.value)} /> : null}
            </div>
          </div>

          <div className="ann-set-group">
            <h2 className="ann-set-title">How it shows</h2>
            <Switch label="Must-see" hint={'Pops up on each student\'s dashboard until they press "I\'ve read this". Keep it rare and short: students learn to close pop-ups.'} on={mustSee} onChange={setMustSee} />
            <Switch
              label="Ask students to confirm"
              hint={mustSee ? 'On for every Must-see notice.' : 'The opened notice shows "I\'ve read this"; Follow-up counts who confirmed. For the notices that matter.'}
              on={askConfirm || mustSee}
              locked={mustSee}
              onChange={setAskConfirm}
            />
            <Switch label="Pin to top" hint="Shows above the others. The top pinned notice shows big, with its picture." on={pinned} onChange={setPinned} />
            <Switch label="Students can close it" hint="Shows ✕ on the notice. A closed notice moves to the foot of their list." on={dismissible} onChange={setDismissible} />
            <label className="ann-switch-row">
              <span className="ann-switch-words">
                <span className="ann-switch-label">Priority</span>
                <span className="ann-hint">Higher shows first. 1 is the usual.</span>
              </span>
              <input className="ann-input ann-priority" type="number" min={0} max={99} value={priority} onChange={(e) => setPriority(e.target.value)} />
            </label>
          </div>
        </aside>
      </div>

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        notice={{
          title,
          kind,
          icon: kindIcon(kindRow?.icon),
          body,
          fullUrl: showFull,
          listUrl: showList,
          askConfirm: askConfirm || mustSee,
          mustSee,
          date: longWhen(notice?.start_at || notice?.created_at || new Date(openedAt).toISOString()),
        }}
      />

      <BodyPortal>
        <div className="ann-overlay">
          <KindsPanel open={kindsOpen} onClose={() => setKindsOpen(false)} kinds={kinds} usedBy={usedBy} onError={err} onDone={ok} />
          {notice ? (
            <FollowUpPanel
              notice={followOpen ? { announcement_id: notice.announcement_id, title: notice.title, when: `made ${longWhen(notice.created_at)}`, askConfirm: Boolean(notice.ask_confirm) } : null}
              onClose={() => setFollowOpen(false)}
            />
          ) : null}
        </div>
      </BodyPortal>
    </div>
  );
}

/** One setting's switch, its hint beneath its name; a locked one stays on (Must-see's confirm). */
function Switch({ label, hint, on, locked = false, onChange }: { label: string; hint: string; on: boolean; locked?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="ann-switch-row">
      <span className="ann-switch-words">
        <span className="ann-switch-label">{label}</span>
        <span className="ann-hint">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-disabled={locked || undefined}
        className={`ann-switch${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
        onClick={() => {
          if (!locked) onChange(!on);
        }}
      >
        <span className="ann-switch-knob" />
      </button>
    </div>
  );
}
