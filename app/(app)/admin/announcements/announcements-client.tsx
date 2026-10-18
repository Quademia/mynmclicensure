// app/(app)/admin/announcements/announcements-client.tsx
//
// The script block of legacy admin/announcements.html (slice 11a): the
// five counts, the search / status / audience filters, the table
// (title with programme chips, the computed status pill and the pinned
// badge, audience, schedule, the seen / tapped / dismissed counts (A2),
// flags, Edit), the side panel — title, the body box with its Bold /
// Italic / Link / Button helpers and the dead "Quiz Link" one, the
// character count, the live preview, status (draft / active /
// archived — rebuild.md §9 #18), priority, start and end, the pin and
// dismissible switches, the eight targeting controls and the live
// audience sentence — the duplicate-title check, the
// newline-to-paragraph and allow-list sanitising at save, and Archive
// with its confirm dialog. The lists arrive as props; after a write the
// route is refreshed so the props carry the new rows (legacy
// re-fetched). Errors and "done" messages are toasts (UI convention #1)
// where legacy used the panel's inline alert boxes.
//
// Carried as legacy had it: the Link and Button helpers use the
// browser's prompt(); the Quiz Link helper is disabled and says so when
// pressed; a remembered specific user shows as their id until searched
// again; the start / end values pass through as the input gives them.
//
// One legacy quirk changed: the student search ran a query on every
// keystroke; here it waits 300 ms after typing stops, as legacy's own
// debounce intended.

'use client';
import { LinkDialog } from '@/lib/overlays/shared/link-dialog';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { archiveAnnouncement, removeAnnouncementPicture, saveAnnouncement, searchStudentsForScope, setAnnouncementPicture } from '@/lib/announcements/actions';
import { kindIcon, pictureUrl } from '@/lib/announcements/display';
import { makePicture, type MadePicture } from '@/lib/announcements/picture-maker';
import { DEFAULT_KIND, type AnnouncementKind, type ReachMap } from '@/lib/announcements/types';
import { previewReach } from '@/lib/announcements/followup-actions';
import { KindsPanel } from './kinds-panel';
import { FollowUpPanel } from './followup-panel';
import { computeDisplayStatus } from '@/lib/announcements/scoping';
import { htmlToText, newlinesToParagraphs, sanitiseHtml } from '@/lib/announcements/sanitise';
import { LEVELS, type Announcement, type EngageMap } from '@/lib/announcements/types';
import type { Course, Product, Program } from '@/lib/catalogue/types';
import type { StudentHit } from '@/lib/subscriptions/types';
import { Icon } from '@/components/shell/icons';

type Msg = { text: string; tone: 'error' | 'success' } | null;
type SelectedUser = { user_id: string; name: string };

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// legacy fillForm: new Date(x).toISOString().slice(0, 16) into datetime-local
function toLocalInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : '';
}

function studentName(u: StudentHit): string {
  return u.name || `${u.forename || ''} ${u.surname || ''}`.trim() || u.email;
}

export function AnnouncementsClient({
  announcements,
  engage,
  programs,
  courses,
  products,
  cohorts,
  kinds,
  reach,
}: {
  announcements: Announcement[];
  engage: EngageMap;
  programs: Program[];
  courses: Course[];
  products: Product[];
  cohorts: string[];
  kinds: AnnouncementKind[];
  /** Each notice's reach today (08.11). */
  reach: ReachMap;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);
  const err = (text: string) => setMsg({ text, tone: 'error' });
  const ok = (text: string) => setMsg({ text, tone: 'success' });

  // ── stats (legacy updateStats) ──
  const statuses = announcements.map((a) => computeDisplayStatus(a));
  const count = (s: string) => statuses.filter((x) => x === s).length;

  // ── filters (legacy applyFilters) ──
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fAudience, setFAudience] = useState('');
  const q = search.toLowerCase().trim();
  const filtered = announcements.filter((a) => {
    if (q && !a.title.toLowerCase().includes(q)) return false;
    if (fStatus && computeDisplayStatus(a) !== fStatus) return false;
    if (fAudience && a.scope_audience !== fAudience) return false;
    return true;
  });

  // ── the side panel form (legacy resetForm / fillForm) ──
  // ── the kinds (08.13): the panel, and each kind's announcements counted ──
  const [kindsOpen, setKindsOpen] = useState(false);
  const usedBy: Record<string, number> = {};
  for (const a of announcements) usedBy[a.kind] = (usedBy[a.kind] ?? 0) + 1;
  const firstKind = kinds.find((k) => k.active && k.name === DEFAULT_KIND)?.name ?? kinds.find((k) => k.active)?.name ?? DEFAULT_KIND;
  const [kind, setKind] = useState(firstKind);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingStatus, setEditingStatus] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('draft');
  const [priority, setPriority] = useState('1');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [pinned, setPinned] = useState(false);
  const [dismissible, setDismissible] = useState(true);
  const [mustSee, setMustSee] = useState(false);
  const [audience, setAudience] = useState('ALL');
  const [subKind, setSubKind] = useState('');
  const [cohort, setCohort] = useState('');
  const [progs, setProgs] = useState<string[]>([]);
  const [scopeCourses, setScopeCourses] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [scopeProducts, setScopeProducts] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userHits, setUserHits] = useState<StudentHit[] | null>(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // ── the picture (08.10): made small here, sent after the notice saves ──
  type NewPicture = MadePicture & { fullUrl: string; listUrl: string };
  const [currentPicture, setCurrentPicture] = useState<string | null>(null);
  const [newPicture, setNewPicture] = useState<NewPicture | null>(null);
  const [dropPicture, setDropPicture] = useState(false);
  const [makingPicture, setMakingPicture] = useState(false);
  const pictureInput = useRef<HTMLInputElement | null>(null);

  function clearNewPicture() {
    setNewPicture((p) => {
      if (p) {
        URL.revokeObjectURL(p.fullUrl);
        URL.revokeObjectURL(p.listUrl);
      }
      return null;
    });
  }

  async function choosePicture(file: File | undefined) {
    if (!file) return;
    setMakingPicture(true);
    try {
      const made = await makePicture(file);
      clearNewPicture();
      setNewPicture({ ...made, fullUrl: URL.createObjectURL(made.full), listUrl: URL.createObjectURL(made.list) });
      setDropPicture(false);
    } catch (e) {
      err(e instanceof Error && e.message === 'too big' ? 'That file is too big (over 15 MB).' : 'That file could not be read as a picture. Please choose a JPEG, PNG or WebP picture.');
    } finally {
      setMakingPicture(false);
      if (pictureInput.current) pictureInput.current.value = '';
    }
  }

  function removePicture() {
    clearNewPicture();
    setDropPicture(true);
  }

  const activeProducts = products.filter((p) => p.status === 'active');

  function resetForm() {
    setTitle('');
    setKind(firstKind);
    setBody('');
    setStatus('draft');
    setPriority('1');
    setStartAt('');
    setEndAt('');
    setPinned(false);
    setMustSee(false);
    setDismissible(true);
    setAudience('ALL');
    setSubKind('');
    setCohort('');
    setProgs([]);
    setScopeCourses([]);
    setLevels([]);
    setScopeProducts([]);
    setSelectedUsers([]);
    setUserSearch('');
    setUserHits(null);
    setCurrentPicture(null);
    clearNewPicture();
    setDropPicture(false);
  }

  function openPanel(id: string | null) {
    setSaving(false);
    clearNewPicture();
    setDropPicture(false);
    if (!id) {
      setEditingId('');
      setEditingStatus('');
      resetForm();
    } else {
      const a = announcements.find((x) => x.announcement_id === id);
      if (!a) return;
      setEditingId(a.announcement_id);
      setEditingStatus(a.status);
      setTitle(a.title || '');
      setKind(a.kind || firstKind);
      setBody(a.body_html || a.body_text || '');
      setCurrentPicture(a.picture_path);
      // §9 #18: a legacy row saved as 'scheduled' shows as draft in the form
      setStatus(a.status === 'active' || a.status === 'archived' ? a.status : 'draft');
      setPriority(String(a.priority != null ? a.priority : 1));
      setStartAt(toLocalInput(a.start_at));
      setEndAt(toLocalInput(a.end_at));
      setPinned(Boolean(a.pinned));
      setDismissible(Boolean(a.dismissible));
      setMustSee(Boolean(a.must_see));
      setAudience(a.scope_audience || 'ALL');
      setSubKind(a.scope_subscription_kind || '');
      setCohort(a.scope_cohort || '');
      setProgs(a.scope_programs || []);
      setScopeCourses(a.scope_courses || []);
      setLevels(a.scope_level || []);
      setScopeProducts(a.scope_product_ids || []);
      setSelectedUsers((a.scope_user_ids || []).map((uid) => ({ user_id: uid, name: uid })));
      setUserSearch('');
      setUserHits(null);
    }
    setPanelOpen(true);
  }

  const closePanel = () => setPanelOpen(false);

  // ── user search (legacy searchUsers, 300 ms) ──
  useEffect(() => {
    if (!panelOpen) return;
    const term = userSearch.trim();
    if (term.length < 2) return;
    const id = window.setTimeout(async () => {
      const hits = await searchStudentsForScope(term);
      setUserHits(hits);
    }, 300);
    return () => window.clearTimeout(id);
  }, [userSearch, panelOpen]);

  function onUserSearchChange(value: string) {
    setUserSearch(value);
    if (value.trim().length < 2) setUserHits(null);
  }

  function addUser(u: StudentHit) {
    if (selectedUsers.find((s) => s.user_id === u.user_id)) return;
    setSelectedUsers((list) => [...list, { user_id: u.user_id, name: studentName(u) }]);
    setUserSearch('');
    setUserHits(null);
  }

  function removeUser(userId: string) {
    setSelectedUsers((list) => list.filter((u) => u.user_id !== userId));
  }

  // ── editor helpers (legacy wrapTag / insertLink / insertButton) ──
  function wrapTag(tag: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || 'text';
    setBody(ta.value.slice(0, s) + `<${tag}>${sel}</${tag}>` + ta.value.slice(e));
    ta.focus();
  }

  function escapeHtml(str: string): string {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // DS4: the four window.prompt() boxes (URL then text, twice) are two
  // "Insert" dialogs with both fields at once; the labels are the
  // prompts' words. The Quiz Link tool is gone with its alert — the
  // alert said the quiz engine was not built, which stopped being true
  // in slice 5; a real quiz-link picker is a line under 05-announcements.
  const [linkDialog, setLinkDialog] = useState<'link' | 'button' | null>(null);

  function insertLink({ url, text }: { url: string; text: string }) {
    const ta = bodyRef.current;
    const pos = ta ? ta.selectionStart : body.length;
    setBody(body.slice(0, pos) + `<a href="${url}">${escapeHtml(text || url)}</a>` + body.slice(pos));
    setLinkDialog(null);
    ta?.focus();
  }

  function insertButton({ url, text }: { url: string; text: string }) {
    setBody(body + (body ? '\n' : '') + `<a href="${url}" data-qa="btn">${escapeHtml(text || 'Open')}</a>`);
    setLinkDialog(null);
    bodyRef.current?.focus();
  }

  // legacy updateCharCount: visible characters only
  const charCount = htmlToText(body).length;
  const charColor = charCount > 800 ? 'var(--danger)' : charCount > 500 ? 'var(--warning)' : 'var(--text-muted)';
  const previewHtml = body.trim() ? sanitiseHtml(newlinesToParagraphs(body)) : '';

  // ── the live audience sentence (legacy refreshSummary) ──
  // ── the reach line (08.12): "This will reach N students today", counted
  // by the database a moment after the scopes stop changing; an answer is
  // kept with the scopes it was counted for, so a stale one never shows ──
  const userIds = selectedUsers.map((u) => u.user_id);
  const scopeKey = JSON.stringify([audience, progs, scopeCourses, levels, subKind, scopeProducts, userIds, cohort]);
  const [reachCount, setReachCount] = useState<{ key: string; n: number } | null>(null);
  const reachNow = reachCount && reachCount.key === scopeKey ? reachCount.n : null;
  useEffect(() => {
    if (!panelOpen) return;
    let stopped = false;
    const [aud, pr, co, lv, sk, pd, us, ch] = JSON.parse(scopeKey) as [string, string[], string[], string[], string, string[], string[], string];
    const timer = window.setTimeout(() => {
      previewReach({
        scope_audience: aud,
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
  }, [panelOpen, scopeKey]);

  // ── the follow-up (08.11) ──
  const [followTarget, setFollowTarget] = useState<{ announcement_id: string; title: string; when: string } | null>(null);

  const summaryParts: React.ReactNode[] = [];
  summaryParts.push(<strong key="aud">{audience === 'STUDENTS' ? 'students only' : 'all users'}</strong>);
  if (progs.length) {
    const names = progs.map((id) => programs.find((p) => p.program_id === id)?.program_name || id);
    summaryParts.push(<span key="prog">in the <strong>{names.join(', ')}</strong> programme{progs.length > 1 ? 's' : ''}</span>);
  }
  if (scopeCourses.length) {
    const names = scopeCourses.map((id) => courses.find((c) => c.course_id === id)?.title || id);
    summaryParts.push(<span key="course">studying <strong>{names.join(', ')}</strong></span>);
  }
  if (levels.length) summaryParts.push(<span key="lvl">at <strong>{levels.join(', ')}</strong></span>);
  if (subKind) {
    const label = ({ PAID: 'paid', TRIAL: 'trial', FREE: 'free' } as Record<string, string>)[subKind] || subKind;
    summaryParts.push(<span key="kind">with a <strong>{label}</strong> subscription</span>);
  }
  if (scopeProducts.length) {
    const names = scopeProducts.map((id) => products.find((p) => p.product_id === id)?.name || id);
    summaryParts.push(<span key="prod">subscribed to <strong>{names.join(', ')}</strong></span>);
  }
  if (cohort) summaryParts.push(<span key="cohort">from the <strong>{cohort}</strong> cohort</span>);
  if (selectedUsers.length) {
    summaryParts.push(<span key="users">— <strong>{selectedUsers.length} specific user{selectedUsers.length > 1 ? 's' : ''}</strong> only</span>);
  }

  // ── save (legacy saveAnnouncement) ──
  async function save() {
    if (!title.trim()) return err('Title is required.');
    setSaving(true);
    try {
      await saveAll();
    } catch {
      // a dropped connection rejects (AGENTS.md); the form keeps what was typed
      err('Could not save. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    const bodyHtml = sanitiseHtml(newlinesToParagraphs(body.trim()));
    const result = await saveAnnouncement({
      announcement_id: editingId || null,
      title: title.trim(),
      body_html: bodyHtml,
      body_text: htmlToText(bodyHtml),
      status,
      priority: Number.parseInt(priority, 10) || 1,
      pinned,
      dismissible,
      must_see: mustSee,
      kind,
      scope_audience: audience,
      scope_subscription_kind: subKind,
      scope_cohort: cohort,
      scope_programs: progs,
      scope_courses: scopeCourses,
      scope_levels: levels,
      scope_product_ids: scopeProducts,
      scope_user_ids: selectedUsers.map((u) => u.user_id),
      start_at: startAt,
      end_at: endAt,
    });
    if (!result.ok) return err(result.error);

    // the picture goes once the notice is saved: it needs the notice's id
    const id = result.announcement_id;
    if (newPicture) {
      const form = new FormData();
      form.set('announcement_id', id);
      form.set('ext', newPicture.ext);
      const type = newPicture.ext === 'jpg' ? 'image/jpeg' : 'image/webp';
      form.set('full', new File([newPicture.full], `full.${newPicture.ext}`, { type }));
      form.set('list', new File([newPicture.list], `list.${newPicture.ext}`, { type }));
      const pic = await setAnnouncementPicture(form);
      if (!pic.ok) {
        // the notice is saved: keep the panel so the picture can be sent again
        setEditingId(id);
        router.refresh();
        return err(`Saved, but: ${pic.error}`);
      }
    } else if (dropPicture && currentPicture) {
      const gone = await removeAnnouncementPicture(id);
      if (!gone.ok) {
        router.refresh();
        return err(`Saved, but: ${gone.error}`);
      }
    }

    ok(result.created ? 'Announcement created.' : 'Announcement updated.');
    router.refresh();
    window.setTimeout(closePanel, 1200);
  }

  // ── archive (legacy triggerArchive / confirmArchive) ──
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);
  const [archiving, setArchiving] = useState(false);

  function triggerArchive() {
    if (!editingId) return;
    const a = announcements.find((x) => x.announcement_id === editingId);
    setArchiveTarget({ id: editingId, title: a ? a.title : editingId });
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    const result = await archiveAnnouncement(archiveTarget.id);
    setArchiving(false);
    if (!result.ok) return err(result.error);
    setArchiveTarget(null);
    closePanel();
    router.refresh();
  }

  function toggleIn(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  return (
    <div className="ann">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />
      <LinkDialog
        open={linkDialog === 'link'}
        title="Insert link"
        urlLabel="Link URL:"
        textLabel="Link text:"
        onSubmit={insertLink}
        onCancel={() => setLinkDialog(null)}
      />
      <LinkDialog
        open={linkDialog === 'button'}
        title="Insert button"
        urlLabel="Button URL:"
        textLabel="Button label:"
        textDefault="Open"
        onSubmit={insertButton}
        onCancel={() => setLinkDialog(null)}
      />

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{announcements.length}</div></div>
        <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value">{count('active')}</div></div>
        <div className="stat-card"><div className="stat-label">Scheduled</div><div className="stat-value">{count('scheduled')}</div></div>
        <div className="stat-card"><div className="stat-label">Draft</div><div className="stat-value">{count('draft')}</div></div>
        <div className="stat-card"><div className="stat-label">Archived</div><div className="stat-value">{count('archived')}</div></div>
      </div>

      {/* Filters */}
      <div className="card filters-card">
        <div className="filters-bar">
          <input type="text" placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
          <select value={fAudience} onChange={(e) => setFAudience(e.target.value)}>
            <option value="">All audiences</option>
            <option value="ALL">Everyone</option>
            <option value="STUDENTS">Students only</option>
          </select>
          <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setFStatus(''); setFAudience(''); }}>Clear</button>
          <button type="button" className="btn btn-ghost kinds-btn" onClick={() => setKindsOpen(true)}>Kinds</button>
          <button type="button" className="btn btn-primary" onClick={() => openPanel(null)}>+ New Announcement</button>
          <span className="result-count">{filtered.length} announcement{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="card table-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th><th>Status</th><th>Audience</th><th>Schedule</th><th>Engagement</th><th>Flags</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length ? (
                <tr><td colSpan={7} className="empty-state">No announcements found.</td></tr>
              ) : (
                filtered.map((a) => {
                  const ds = computeDisplayStatus(a);
                  const schedule = a.start_at || a.end_at ? `${a.start_at ? fmtShort(a.start_at) : '—'} → ${a.end_at ? fmtShort(a.end_at) : '∞'}` : 'Always';
                  const ec = engage[a.announcement_id] || { seen: 0, tapped: 0, dismissed: 0 };
                  return (
                    <tr key={a.announcement_id} onClick={() => openPanel(a.announcement_id)}>
                      <td>
                        <div className="cell-title">{a.title}</div>
                        {(a.scope_programs || []).map((p) => <span key={p} className="prog-badge">{p}</span>)}
                      </td>
                      <td>
                        <span className={`badge badge-${ds}`}>{ds}</span>
                        {a.pinned ? <span className="badge badge-pinned pinned-gap">Pinned</span> : null}
                      </td>
                      <td className="cell-13">{a.scope_audience === 'ALL' || !a.scope_audience ? 'Everyone' : a.scope_audience}</td>
                      <td className="cell-muted">{schedule}</td>
                      <td>
                        <div className="engage-counts">
                          <span title={`Seen, of ${reach[a.announcement_id] ?? 0} reached today`}><Icon name="check-circle" size={13} />{ec.seen}/{reach[a.announcement_id] ?? 0}</span><span title="Tapped"><Icon name="pointer" size={13} />{ec.tapped}</span><span title="Dismissed"><Icon name="x" size={13} />{ec.dismissed}</span>
                        </div>
                      </td>
                      <td className="cell-flags">{a.dismissible ? <span>dismissible</span> : null}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openPanel(a.announcement_id); }}>Edit</button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFollowTarget({ announcement_id: a.announcement_id, title: a.title, when: a.created_at ? `made ${fmtShort(a.created_at)}` : '' });
                            }}
                          >
                            Follow-up
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BodyPortal>
        <div className="ann-overlay">
          <KindsPanel open={kindsOpen} onClose={() => setKindsOpen(false)} kinds={kinds} usedBy={usedBy} onError={err} onDone={ok} />
          <FollowUpPanel notice={followTarget} onClose={() => setFollowTarget(null)} />
          {/* Side panel */}
          <div className={`panel-overlay${panelOpen ? ' show' : ''}`} onClick={closePanel} />
          <div className={`side-panel${panelOpen ? ' open' : ''}`}>
            <div className="panel-header">
              <div>
                <h2>{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                <p>{editingId ? `ID: ${editingId}` : 'Fill in the details below'}</p>
              </div>
              <button type="button" className="panel-close" onClick={closePanel}>×</button>
            </div>

            <div className="panel-body">
              <div className="form-section-title">Content</div>

              <div className="form-group">
                <label htmlFor="fieldTitle">Title <span className="req">*</span></label>
                <input id="fieldTitle" type="text" placeholder="e.g. New Mock Exam Available" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="form-group">
                <label htmlFor="fieldKind">Kind</label>
                <div className="kind-pick">
                  <span className="kind-square" aria-hidden="true"><Icon name={kindIcon(kinds.find((k) => k.name === kind)?.icon)} size={20} /></span>
                  <select id="fieldKind" value={kind} onChange={(e) => setKind(e.target.value)}>
                    {kinds
                      .filter((k) => k.active || k.name === kind)
                      .map((k) => (
                        <option key={k.name} value={k.name}>{k.name}{k.active ? '' : ' (retired)'}</option>
                      ))}
                  </select>
                </div>
                <p className="form-hint">Its icon shows beside the title in students&apos; list. Add or change kinds under Kinds.</p>
              </div>

              <div className="form-group">
                <label htmlFor="fieldBody">Body</label>
                <div className="editor-toolbar">
                  <button type="button" onClick={() => wrapTag('strong')}><b>B</b></button>
                  <button type="button" onClick={() => wrapTag('em')}><i>I</i></button>
                  <div className="sep" />
                  <button type="button" onClick={() => setLinkDialog('link')}><Icon name="link" />Link</button>
                  <button type="button" onClick={() => setLinkDialog('button')}><Icon name="square" />Button</button>
                </div>
                <textarea id="fieldBody" ref={bodyRef} rows={6} placeholder="Write your announcement body here." value={body} onChange={(e) => setBody(e.target.value)} />
                <p className="form-hint right" style={{ color: charColor }}>{charCount} character{charCount !== 1 ? 's' : ''}</p>
              </div>

              <div className="form-group">
                <label htmlFor="fieldPicture">Picture (optional)</label>
                {newPicture ? (
                  <div className="pic-previews">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the made picture */}
                    <img className="pic-full" src={newPicture.fullUrl} alt="The picture as students will see it opened" />
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the list's square */}
                    <img className="pic-list" src={newPicture.listUrl} alt="The list's square" />
                  </div>
                ) : currentPicture && !dropPicture ? (
                  <div className="pic-previews">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the stored picture, already small */}
                    <img className="pic-full" src={pictureUrl(currentPicture, 'full') ?? ''} alt="The picture as students see it opened" />
                    {/* eslint-disable-next-line @next/next/no-img-element -- the stored list square */}
                    <img className="pic-list" src={pictureUrl(currentPicture, 'list') ?? ''} alt="The list's square" />
                  </div>
                ) : null}
                <input
                  id="fieldPicture"
                  ref={pictureInput}
                  type="file"
                  accept="image/*"
                  className="pic-input"
                  onChange={(e) => void choosePicture(e.target.files?.[0])}
                />
                <div className="pic-actions">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={makingPicture} onClick={() => pictureInput.current?.click()}>
                    {makingPicture ? 'Making it smaller…' : newPicture || (currentPicture && !dropPicture) ? 'Replace picture' : 'Choose a picture'}
                  </button>
                  {newPicture || (currentPicture && !dropPicture) ? (
                    <button type="button" className="btn-link danger" onClick={removePicture}>Remove</button>
                  ) : null}
                </div>
                <p className="form-hint">
                  Wide, about 1200 × 600: the middle is kept at that shape, and the list shows its middle square. It is made smaller on this computer before it is sent
                  {newPicture ? ` (${Math.max(1, Math.round(newPicture.full.size / 1024))} KB and ${Math.max(1, Math.round(newPicture.list.size / 1024))} KB). Saved with the announcement.` : '.'}
                  {dropPicture && currentPicture ? ' The picture is removed when you save.' : ''}
                </p>
              </div>

              <div className="form-group">
                <label>Live Preview</label>
                {previewHtml ? (
                  <div className="preview-box" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <div className="preview-box"><span className="muted">Preview will appear here as you type…</span></div>
                )}
              </div>

              <div className="form-section-title">Settings</div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fieldStatus">Status</label>
                  <select id="fieldStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="draft">Draft — not visible yet</option>
                    <option value="active">Active — visible now</option>
                    <option value="archived">Archived — hidden</option>
                  </select>
                  {status === 'draft' || status === 'archived' ? (
                    <div className="status-warning">
                      This announcement is set to <strong>{status === 'draft' ? 'Draft' : 'Archived'}</strong> — students will not see it until you change the status to Active.
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label htmlFor="fieldPriority">Priority</label>
                  <input id="fieldPriority" type="number" min={0} max={99} value={priority} onChange={(e) => setPriority(e.target.value)} />
                  <p className="form-hint">Higher = shows first. 1 is default.</p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fieldStartAt">Start date/time (optional)</label>
                  <input id="fieldStartAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                  <p className="form-hint">Leave blank to show immediately.</p>
                </div>
                <div className="form-group">
                  <label htmlFor="fieldEndAt">End date/time (optional)</label>
                  <input id="fieldEndAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                  <p className="form-hint">Leave blank to show indefinitely.</p>
                </div>
              </div>

              <div className="toggle-box">
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Pin to top</div>
                    <div className="toggle-hint">Always appears above others</div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                </div>
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">✕ Dismissible</div>
                    <div className="toggle-hint">Students can close this announcement</div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                </div>
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Must-see</div>
                    <div className="toggle-hint">Also pops up once on each student&apos;s dashboard. Keep it for the rare notice that cannot be missed.</div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={mustSee} onChange={(e) => setMustSee(e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                </div>
              </div>

              <div className="form-section-title">Targeting</div>
              <p className="targeting-note">All scopes work as AND — a student must match every condition you set. Leave everything blank to show to everyone.</p>

              <div className="form-group">
                <label htmlFor="fieldAudience">Audience</label>
                <select id="fieldAudience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="ALL">Everyone (all users)</option>
                  <option value="STUDENTS">Students only</option>
                </select>
              </div>

              <div className="form-group">
                <label>Programme</label>
                <p className="form-hint below">Leave all unticked = all programmes.</p>
                <div className="scope-picker">
                  {programs.length ? programs.map((p) => (
                    <label key={p.program_id}>
                      <input type="checkbox" checked={progs.includes(p.program_id)} onChange={() => setProgs((l) => toggleIn(l, p.program_id))} /> {p.program_name || p.program_id}
                    </label>
                  )) : <span className="muted small">No programmes found</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Course</label>
                <p className="form-hint below">Leave all unticked = all courses.</p>
                <div className="scope-picker">
                  {courses.length ? courses.map((c) => (
                    <label key={c.course_id}>
                      <input type="checkbox" checked={scopeCourses.includes(c.course_id)} onChange={() => setScopeCourses((l) => toggleIn(l, c.course_id))} /> {c.title}
                    </label>
                  )) : <span className="muted small">No courses found</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Level</label>
                <p className="form-hint below">Leave all unticked = all levels.</p>
                <div className="scope-picker">
                  {LEVELS.map((lvl) => (
                    <label key={lvl}>
                      <input type="checkbox" checked={levels.includes(lvl)} onChange={() => setLevels((l) => toggleIn(l, lvl))} /> {lvl}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fieldSubKind">Subscription kind</label>
                <select id="fieldSubKind" value={subKind} onChange={(e) => setSubKind(e.target.value)}>
                  <option value="">All subscription kinds</option>
                  <option value="PAID">Paid subscribers only</option>
                  <option value="TRIAL">Trial users only</option>
                  <option value="FREE">Free users only</option>
                </select>
              </div>

              <div className="form-group">
                <label>Product</label>
                <p className="form-hint below">Leave all unticked = all products.</p>
                <div className="scope-picker">
                  {activeProducts.length ? activeProducts.map((p) => (
                    <label key={p.product_id}>
                      <input type="checkbox" checked={scopeProducts.includes(p.product_id)} onChange={() => setScopeProducts((l) => toggleIn(l, p.product_id))} /> {p.name}
                    </label>
                  )) : <span className="muted small">No active products found</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fieldCohort">Cohort</label>
                <select id="fieldCohort" value={cohort} onChange={(e) => setCohort(e.target.value)}>
                  <option value="">All cohorts</option>
                  {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="userSearchInput">Specific users</label>
                <p className="form-hint below">Search and add individual students. Leave empty = not restricted to specific users.</p>
                <input id="userSearchInput" type="text" placeholder="Type a name or email to search…" autoComplete="off" value={userSearch} onChange={(e) => onUserSearchChange(e.target.value)} />
                <div className={`user-search-results${userHits ? ' show' : ''}`}>
                  {userHits && !userHits.length ? (
                    <div className="user-result-item muted">No students found</div>
                  ) : (
                    (userHits || []).map((u) => {
                      const already = selectedUsers.some((s) => s.user_id === u.user_id);
                      return (
                        <div key={u.user_id} className={`user-result-item${already ? ' already' : ''}`} onClick={() => { if (!already) addUser(u); }}>
                          <div className="user-result-name">{studentName(u)} {already ? '✓' : ''}</div>
                          <div className="user-result-meta">{u.email} · {u.program_id || '—'}</div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="user-tag-wrap">
                  {selectedUsers.length ? selectedUsers.map((u) => (
                    <span key={u.user_id} className="user-tag">
                      {u.name}
                      <button type="button" onClick={() => removeUser(u.user_id)} title="Remove">×</button>
                    </span>
                  )) : <span className="muted small tag-empty">No specific users selected</span>}
                </div>
              </div>

              <div className="audience-summary">
                This announcement will be shown to {summaryParts.map((part, i) => <span key={i}>{i > 0 ? ', ' : ''}{part}</span>)}.
                <div className="reach-line">
                  {reachNow === null ? 'Counting who it reaches…' : <>This will reach <strong>{reachNow} student{reachNow === 1 ? '' : 's'}</strong> today.</>}
                </div>
              </div>
            </div>

            <div className="panel-footer">
              {editingId && editingStatus !== 'archived' ? (
                <button type="button" className="btn btn-ghost archive-btn" onClick={triggerArchive}>Archive</button>
              ) : null}
              <button type="button" className="btn btn-ghost" onClick={closePanel}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Announcement'}</button>
            </div>
          </div>

          {/* Archive dialog */}
          <div className={`modal-overlay${archiveTarget ? ' show' : ''}`}>
            <div className="modal">
              <div className="modal-header">
                <h3>Archive Announcement</h3>
                <button type="button" className="panel-close" onClick={() => setArchiveTarget(null)}>×</button>
              </div>
              <div className="modal-body">
                <p>Archive &quot;{archiveTarget?.title}&quot;? It will no longer be visible to students. You can restore it by editing and changing the status back to Active.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setArchiveTarget(null)}>Cancel</button>
                <button type="button" className="btn btn-warning" disabled={archiving} onClick={confirmArchive}>{archiving ? 'Archiving…' : 'Archive'}</button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
