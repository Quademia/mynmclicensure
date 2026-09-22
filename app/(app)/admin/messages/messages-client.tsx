// app/(app)/admin/messages/messages-client.tsx
//
// The script block of legacy admin/messages.html (slice 12b): the
// filters bar (a student search debounced 300 ms, type and status on
// the server; "unread only" in the browser), the thread list (the
// student's name and programme, the label, the quoted question for a
// question thread, the preview, the relative time, the context and
// Closed chips, the unread dot), the conversation pane (the student's
// name, the context chip, Close thread / Reopen, the reference card —
// with the question id for a question thread — the flat feed with date
// dividers, "You (Admin)" on the admin's own lines, links made
// clickable, the closed banner, the compose bar with Enter to send),
// the realtime feed on the open thread for a student's message, the
// New Thread dialog (student search or a pasted id, the student's
// courses as a picker, general or course context, subject, the unused
// "Ref text" field legacy showed, the message, "Send (N threads)"),
// and the Bulk Send dialog (five multi-select pickers, Preview count,
// the count line, the confirmation line, general or course context
// with the thread course, subject, message, "Send to all"). After a
// change the list reloads and the sidebar's badge follows through a
// route refresh.
//
// Changed on the way: the page's toast is the shared one (UI
// convention #1); the two dialogs are portalled to <body>; the
// realtime subscription names this product's schema.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { NameCircle } from '@/components/shell/name-circle';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { createClient } from '@/lib/supabase/client';
import {
  adminMarkThreadReadAction,
  adminSendMessageAction,
  adminThreadMessagesAction,
  bulkSendAction,
  closeThreadAction,
  listAdminThreadsAction,
  newThreadAction,
  previewRecipientsAction,
  reopenThreadAction,
  searchStudentsForMessagingAction,
  studentCoursesAction,
} from '@/lib/messaging/admin-actions';
import { EMPTY_ADMIN_FILTERS, type AdminThread, type AdminThreadFilters, type RecipientScope, type StudentHit, type ThreadUser } from '@/lib/messaging/admin-queries';
import type { Message } from '@/lib/messaging/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;

// The clock, read outside render (react-hooks/purity): the relative
// times and date labels are computed from the last load, as legacy
// computed them from the render moment.
function stampNow(set: (n: number) => void) {
  set(Date.now());
}
type CourseBit = { course_id: string; title: string };
type PickItem = { value: string; label: string };

// ── format helpers (legacy) ──
function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '';
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1) + '…';
}
function formatTime(iso: string | null, now: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + 'h ago';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return diffD + 'd ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatDateLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const n = new Date(now);
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.floor((today - msgDay) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== n.getFullYear() ? 'numeric' : undefined });
}
function studentName(u: ThreadUser | null, fallback: string): string {
  if (!u) return fallback;
  return [u.forename, u.surname].filter(Boolean).join(' ') || u.name || u.email || fallback;
}
function linkify(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(https?:\/\/[^\s<]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const url = m[1];
    const tail = url.match(/^(.*?)([.,!?)\]]*)$/);
    const link = tail ? tail[1] : url;
    const rest = tail ? tail[2] : '';
    out.push(
      <a key={k++} href={link} target="_blank" rel="noopener noreferrer">
        {link}
      </a>,
    );
    if (rest) out.push(rest);
    last = m.index + url.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
function RefText({ raw }: { raw: string }) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('Quademia') || line.startsWith('QAcademy')) return <div key={i} className="ref-head">{line}</div>;
        if (line === 'Question:' || line === 'Options (as shown):') return <div key={i} className="ref-section">{line}</div>;
        if (/^(Course|Question|Topic):/.test(line)) {
          const [label, ...rest] = line.split(':');
          return <div key={i}><strong>{label}:</strong> {rest.join(':').trim()}</div>;
        }
        if (/^[A-H]\.\s/.test(line)) return <div key={i} className="ref-option">{line}</div>;
        if (line.startsWith('My answer:')) return <div key={i} className="ref-answer"><strong>My answer:</strong> {line.replace('My answer:', '').trim()}</div>;
        return <div key={i} className="ref-line">{line}</div>;
      })}
    </>
  );
}

// ── the multi-select pill picker (legacy msInit) ──
function MultiPicker({ items, selected, placeholder, onChange }: { items: PickItem[]; selected: string[]; placeholder: string; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);
  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }
  return (
    <div className={`ms-picker${open ? ' open' : ''}`} ref={rootRef}>
      {selected.length ? (
        <div className="ms-selected">
          {selected.map((v) => (
            <span key={v} className="ms-pill">
              {items.find((i) => i.value === v)?.label ?? v}
              <span className="ms-x" onClick={() => onChange(selected.filter((x) => x !== v))}>&times;</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="ms-dropdown" onClick={() => setOpen((o) => !o)}>{selected.length === 0 ? placeholder : `${selected.length} selected`}</div>
      <div className="ms-options">
        {items.map((i) => (
          <div key={i.value} className={`ms-option${selected.includes(i.value) ? ' selected' : ''}`} onClick={() => toggle(i.value)}>
            <span className="ms-check">{selected.includes(i.value) ? '✓' : ''}</span>
            <span>{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminMessagesClient({
  courses,
  programs,
  levels,
  cohorts,
  initialThreads,
}: {
  courses: CourseBit[];
  programs: string[];
  levels: string[];
  cohorts: string[];
  initialThreads: AdminThread[];
}) {
  const router = useRouter();
  const courseTitles: Record<string, string> = {};
  for (const c of courses) courseTitles[c.course_id] = c.title;

  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // ── the list and its filters ──
  const [threads, setThreads] = useState<AdminThread[]>(initialThreads);
  const [filters, setFilters] = useState<AdminThreadFilters>(EMPTY_ADMIN_FILTERS);
  const filtersRef = useRef<AdminThreadFilters>(EMPTY_ADMIN_FILTERS);
  const [searchText, setSearchText] = useState('');
  const searchTimer = useRef<number | null>(null);
  const [readFilter, setReadFilter] = useState('');
  const [now, setNow] = useState(0);

  async function loadThreads(next?: AdminThreadFilters) {
    const f = next ?? filtersRef.current;
    const list = await listAdminThreadsAction(f);
    setThreads(list);
    stampNow(setNow);
    router.refresh(); // the sidebar's badge
    return list;
  }

  function applyFilter(patch: Partial<AdminThreadFilters>) {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    setFilters(next);
    void loadThreads(next);
  }

  function onSearchChange(value: string) {
    setSearchText(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => applyFilter({ search: value.trim() }), 300);
  }

  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    return () => {
      window.clearTimeout(id);
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, []);

  const filtered = readFilter === 'unread' ? threads.filter((t) => t.unread) : threads;

  // ── the conversation ──
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [compose, setCompose] = useState('');
  const [sending, setSending] = useState(false);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null);
  const active = activeId ? threads.find((t) => t.thread_id === activeId) ?? null : null;

  function threadLabel(t: AdminThread | null): string {
    if (!t) return 'Conversation';
    if (t.subject) return t.subject;
    if (t.context_type === 'course' && t.course_id) return courseTitles[t.course_id] || t.course_id;
    if (t.context_type === 'question') return 'Question feedback';
    return 'General';
  }

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const teardownRealtime = useCallback(() => {
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch {
        /* not critical */
      }
      channelRef.current = null;
    }
  }, []);
  useEffect(() => teardownRealtime, [teardownRealtime]);

  function setupRealtime(threadId: string) {
    teardownRealtime();
    try {
      const supabase = createClient();
      const channel = supabase
        .channel('admin-msg-' + threadId)
        .on('postgres_changes', { event: 'INSERT', schema: 'licensure_gh', table: 'messages', filter: `thread_id=eq.${threadId}` }, async (payload) => {
          const newMsg = payload.new as Partial<Message>;
          if (newMsg && newMsg.sender_role === 'student' && activeRef.current === threadId) {
            setMessages(await adminThreadMessagesAction(threadId));
            stampNow(setNow);
            window.setTimeout(scrollToBottom, 0);
            await adminMarkThreadReadAction(threadId);
            await loadThreads();
          }
        })
        .subscribe();
      channelRef.current = { unsubscribe: () => supabase.removeChannel(channel) };
    } catch {
      /* realtime not critical */
    }
  }

  async function openThread(threadId: string) {
    setActiveId(threadId);
    activeRef.current = threadId;
    const msgs = await adminThreadMessagesAction(threadId);
    setMessages(msgs);
    stampNow(setNow);
    window.setTimeout(() => {
      scrollToBottom();
      composeRef.current?.focus();
    }, 0);
    await adminMarkThreadReadAction(threadId);
    setThreads((cur) => cur.map((t) => (t.thread_id === threadId ? { ...t, unread: false } : t)));
    router.refresh();
    setupRealtime(threadId);
  }

  function closeConvo() {
    setActiveId(null);
    activeRef.current = null;
    setMessages([]);
    teardownRealtime();
  }

  async function handleSend() {
    const text = compose.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    const result = await adminSendMessageAction(activeId, text);
    if (result.ok) {
      setCompose('');
      setMessages(await adminThreadMessagesAction(activeId));
      window.setTimeout(scrollToBottom, 0);
      await loadThreads();
    } else {
      setMsg({ text: 'Could not send message.', tone: 'error' });
    }
    setSending(false);
  }

  async function handleClose() {
    if (!activeId) return;
    const r = await closeThreadAction(activeId);
    if (!r.ok) {
      setMsg({ text: r.error, tone: 'error' });
      return;
    }
    setMsg({ text: 'Thread closed.', tone: 'success' });
    await loadThreads();
  }

  async function handleReopen() {
    if (!activeId) return;
    const r = await reopenThreadAction(activeId);
    if (!r.ok) {
      setMsg({ text: r.error, tone: 'error' });
      return;
    }
    setMsg({ text: 'Thread reopened.', tone: 'success' });
    await loadThreads();
  }

  // ── the New Thread dialog ──
  const [ntOpen, setNtOpen] = useState(false);
  const [ntSearch, setNtSearch] = useState('');
  const [ntResults, setNtResults] = useState<StudentHit[] | null>(null);
  const ntTimer = useRef<number | null>(null);
  const [ntSelected, setNtSelected] = useState<StudentHit | null>(null);
  const [ntManualId, setNtManualId] = useState('');
  const ntManualTimer = useRef<number | null>(null);
  const [ntContext, setNtContext] = useState<'general' | 'course'>('general');
  const [ntCourseItems, setNtCourseItems] = useState<PickItem[]>([]);
  const [ntCourseHint, setNtCourseHint] = useState('Select a student first to load their courses.');
  const [ntCourses, setNtCourses] = useState<string[]>([]);
  const [ntSubject, setNtSubject] = useState('');
  const [ntRefText, setNtRefText] = useState('');
  const [ntBody, setNtBody] = useState('');
  const [ntSending, setNtSending] = useState(false);

  function openNewThread() {
    setNtOpen(true);
    setNtSearch('');
    setNtResults(null);
    setNtSelected(null);
    setNtManualId('');
    setNtContext('general');
    setNtCourseItems([]);
    setNtCourses([]);
    setNtCourseHint('Select a student first to load their courses.');
    setNtSubject('');
    setNtRefText('');
    setNtBody('');
  }

  function onNtSearch(value: string) {
    setNtSearch(value);
    if (ntTimer.current) window.clearTimeout(ntTimer.current);
    ntTimer.current = window.setTimeout(async () => {
      const q = value.trim();
      if (q.length < 2) {
        setNtResults(null);
        return;
      }
      setNtResults(await searchStudentsForMessagingAction(q));
    }, 300);
  }

  async function ntLoadCourses(userId: string) {
    setNtCourseHint('Loading courses...');
    setNtCourseItems([]);
    setNtCourses([]);
    const ids = await studentCoursesAction(userId);
    const items = ids.map((cid) => ({ value: cid, label: courseTitles[cid] || cid }));
    setNtCourseItems(items);
    setNtCourseHint(items.length ? `${items.length} course${items.length !== 1 ? 's' : ''} available` : 'This student has no active course entitlements.');
  }

  async function ntSelect(u: StudentHit) {
    setNtSelected(u);
    setNtResults(null);
    setNtManualId('');
    await ntLoadCourses(u.user_id);
  }

  function onNtManual(value: string) {
    setNtManualId(value);
    if (ntManualTimer.current) window.clearTimeout(ntManualTimer.current);
    const uid = value.trim();
    if (uid.length >= 3) ntManualTimer.current = window.setTimeout(() => void ntLoadCourses(uid), 500);
  }

  const ntUserId = ntSelected?.user_id || ntManualId.trim();
  const ntReady = Boolean(ntUserId) && Boolean(ntBody.trim()) && (ntContext !== 'course' || ntCourses.length > 0);
  const ntSendLabel = ntSending ? 'Sending...' : ntContext === 'course' && ntCourses.length > 1 ? `Send (${ntCourses.length} threads)` : 'Send';

  async function handleNewThread() {
    if (!ntUserId) return;
    if (!ntBody.trim()) {
      setMsg({ text: 'Message cannot be empty.', tone: 'error' });
      return;
    }
    if (ntContext === 'course' && !ntCourses.length) {
      setMsg({ text: 'Select at least one course.', tone: 'error' });
      return;
    }
    setNtSending(true);
    const result = await newThreadAction({ userId: ntUserId, contextType: ntContext, courseIds: ntCourses, subject: ntSubject.trim(), body: ntBody.trim() });
    setNtSending(false);
    if (!result.ok) {
      setMsg({ text: result.error, tone: 'error' });
      return;
    }
    setNtOpen(false);
    setMsg({ text: result.threadCount > 1 ? `${result.threadCount} threads created.` : 'Thread created.', tone: 'success' });
    await loadThreads();
    await openThread(result.lastThreadId);
  }

  // ── the Bulk Send dialog ──
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bkProgrammes, setBkProgrammes] = useState<string[]>([]);
  const [bkLevels, setBkLevels] = useState<string[]>([]);
  const [bkCohorts, setBkCohorts] = useState<string[]>([]);
  const [bkKinds, setBkKinds] = useState<string[]>([]);
  const [bkCourseScopes, setBkCourseScopes] = useState<string[]>([]);
  const [bkPreview, setBkPreview] = useState<number | null>(null);
  const [bkContext, setBkContext] = useState<'general' | 'course'>('general');
  const [bkCourse, setBkCourse] = useState('');
  const [bkSubject, setBkSubject] = useState('');
  const [bkBody, setBkBody] = useState('');
  const [bkSending, setBkSending] = useState(false);

  function openBulk() {
    setBulkOpen(true);
    setBkProgrammes([]);
    setBkLevels([]);
    setBkCohorts([]);
    setBkKinds([]);
    setBkCourseScopes([]);
    setBkPreview(null);
    setBkContext('general');
    setBkCourse('');
    setBkSubject('');
    setBkBody('');
  }

  function bulkScope(): RecipientScope {
    const scope: RecipientScope = {};
    if (bkProgrammes.length) scope.program_ids = bkProgrammes;
    if (bkLevels.length) scope.level_ids = bkLevels;
    if (bkCohorts.length) scope.cohort_ids = bkCohorts;
    if (bkKinds.length) scope.subscription_kinds = bkKinds;
    if (bkCourseScopes.length) scope.course_ids = bkCourseScopes;
    return scope;
  }

  // Any picker change clears the preview, as legacy did.
  function pick(setter: (v: string[]) => void) {
    return (v: string[]) => {
      setter(v);
      setBkPreview(null);
    };
  }

  async function previewRecipients() {
    setBkPreview(await previewRecipientsAction(bulkScope()));
  }

  async function handleBulkSend() {
    if (!bkBody.trim()) {
      setMsg({ text: 'Message cannot be empty.', tone: 'error' });
      return;
    }
    if (bkPreview === null) {
      setMsg({ text: 'Preview first: click "Preview count" to see how many students will receive this.', tone: 'error' });
      return;
    }
    if (bkPreview === 0) {
      setMsg({ text: 'No recipients match your filters.', tone: 'error' });
      return;
    }
    setBkSending(true);
    const result = await bulkSendAction({
      subject: bkSubject.trim(),
      body: bkBody.trim(),
      scope: bulkScope(),
      contextType: bkContext,
      courseId: bkContext === 'course' ? bkCourse || null : null,
    });
    setBkSending(false);
    if (!result.ok) {
      setMsg({ text: result.error || 'Could not send.', tone: 'error' });
      return;
    }
    setMsg({ text: `Message sent to ${result.count} student${result.count !== 1 ? 's' : ''}.`, tone: 'success' });
    setBulkOpen(false);
    await loadThreads();
  }

  // ── derived for the pane ──
  const activeUser = active?.users ?? null;
  const activeName = studentName(activeUser, active?.user_id || '');
  const feedName = studentName(activeUser, 'Student');

  const dateBlocks: { label: string; items: Message[] }[] = [];
  for (const m of messages) {
    const label = formatDateLabel(m.created_at, now);
    const lastBlock = dateBlocks[dateBlocks.length - 1];
    if (!lastBlock || lastBlock.label !== label) dateBlocks.push({ label, items: [m] });
    else lastBlock.items.push(m);
  }

  return (
    <div className="amsg">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="msg-container">
        <div className="page-header">
          <h1>Messages</h1>
          <div className="header-actions">
            <button type="button" className="btn-action accent" onClick={openNewThread}>+ New Thread</button>
            <button type="button" className="btn-action" onClick={openBulk}>Bulk Send</button>
          </div>
        </div>

        <div className="filters-bar">
          <input type="text" id="filterSearch" placeholder="Search name, email, or question text..." value={searchText} onChange={(e) => onSearchChange(e.target.value)} />
          <select id="filterContext" value={filters.contextType} onChange={(e) => applyFilter({ contextType: e.target.value })}>
            <option value="">All types</option>
            <option value="general">General</option>
            <option value="course">Course</option>
            <option value="question">Question</option>
          </select>
          <select id="filterStatus" value={filters.status} onChange={(e) => applyFilter({ status: e.target.value })}>
            <option value="">All status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select id="filterRead" value={readFilter} onChange={(e) => setReadFilter(e.target.value)}>
            <option value="">All</option>
            <option value="unread">Unread only</option>
          </select>
          <span className="result-count">{filtered.length} thread{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className={`msg-split${activeId ? ' convo-open' : ''}`}>
          <div className="thread-list">
            <div className="thread-list-header"><h2>All Threads</h2></div>
            <div className="thread-items">
              {filtered.length === 0 ? (
                <div className="thread-empty">No threads match your filters.</div>
              ) : (
                filtered.map((t) => {
                  const name = studentName(t.users, t.user_id);
                  const programme = t.users?.program_id || '';
                  return (
                    <div key={t.thread_id} className={`thread-item${t.thread_id === activeId ? ' active' : ''}${t.unread ? ' unread' : ''}`} onClick={() => void openThread(t.thread_id)}>
                      <div className="t-name">
                        {t.unread ? <span className="unread-dot" /> : null}
                        {name}
                        {programme ? <span className="t-programme">{programme}</span> : null}
                      </div>
                      <div className="t-label">{threadLabel(t)}</div>
                      {t.context_type === 'question' && t.ref_text ? <div className="t-preview t-ref">{truncate(t.ref_text, 50)}</div> : null}
                      <div className="t-preview">{t.latest ? truncate(t.latest.body_text, 55) : 'No messages'}</div>
                      <div className="t-meta">
                        <span>{t.latest ? formatTime(t.latest.created_at, now) : ''}</span>
                        {t.context_type !== 'general' ? <span className="context-chip">{t.context_type}</span> : null}
                        {t.status === 'closed' ? <span className="status-chip closed">Closed</span> : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="convo-pane">
            {!active ? (
              <div className="convo-empty">
                <div className="empty-icon">&#128172;</div>
                <div><strong>Select a thread</strong></div>
                <div>to view and reply</div>
              </div>
            ) : (
              <div className="convo-active">
                <div className="convo-header">
                  <div className="convo-header-left">
                    <button type="button" className="back-btn" onClick={closeConvo}>&#8592;</button>
                    <h3>{activeName || 'Conversation'}</h3>
                    {active.context_type !== 'general' ? <span className="context-chip">{active.context_type}</span> : null}
                  </div>
                  <div className="convo-actions">
                    {active.status === 'open' ? (
                      <button type="button" className="btn-sm danger" onClick={() => void handleClose()}>Close thread</button>
                    ) : (
                      <button type="button" className="btn-sm" onClick={() => void handleReopen()}>Reopen</button>
                    )}
                  </div>
                </div>

                {active.context_type === 'question' ? (
                  <div className="ref-wrap">
                    <div className="ref-card">
                      {active.question_id ? <div className="ref-id"><strong>ID:</strong> <code>{active.question_id}</code></div> : null}
                      {active.ref_text ? <RefText raw={active.ref_text} /> : active.course_id ? <><strong>Course:</strong> {courseTitles[active.course_id] || active.course_id}</> : null}
                      <div className="ref-hint">Reply with a fix or explanation. Mention what part is wrong (stem or option) and what should change.</div>
                    </div>
                  </div>
                ) : active.context_type === 'course' && active.course_id ? (
                  <div className="ref-wrap"><div className="ref-card"><strong>Course:</strong> {courseTitles[active.course_id] || active.course_id}</div></div>
                ) : null}

                <div className="convo-messages" ref={messagesRef}>
                  {messages.length === 0 ? (
                    <div className="no-messages">No messages yet.</div>
                  ) : (
                    dateBlocks.map((b) => (
                      <div key={b.label + b.items[0].message_id}>
                        <div className="date-divider"><span>{b.label}</span></div>
                        {b.items.map((m) => {
                          const isAdmin = m.sender_role === 'admin';
                          return (
                            <div key={m.message_id} className={`feed-msg${isAdmin ? ' is-admin' : ''}`}>
                              <div className="feed-header">
                                {isAdmin ? (
                                  <NameCircle who="quademia" size="xs" className="feed-avatar" />
                                ) : (
                                  <NameCircle name={feedName} avatarUrl={activeUser?.avatar_url} size="xs" className="feed-avatar" />
                                )}
                                <span className={`feed-name${isAdmin ? ' admin-name' : ''}`}>{isAdmin ? 'You (Admin)' : feedName}</span>
                                <span className="feed-time">{formatTimeShort(m.created_at)}</span>
                              </div>
                              <div className="feed-body">{linkify(m.body_text)}</div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {active.status === 'closed' ? (
                  <div className="closed-banner">This thread is closed.</div>
                ) : (
                  <div className="compose-bar">
                    <textarea
                      ref={composeRef}
                      placeholder="Type a reply..."
                      rows={1}
                      value={compose}
                      onChange={(e) => {
                        setCompose(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <button type="button" className="btn-send" disabled={sending || !compose.trim()} onClick={() => void handleSend()}>Send</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <BodyPortal>
        <div className="amsg-overlay">
          {/* New Thread */}
          <div className={`modal-overlay${ntOpen ? ' open' : ''}`}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ntTitle">
              <div className="modal-header">
                <h2 id="ntTitle">New Thread</h2>
                <button type="button" className="modal-close" onClick={() => setNtOpen(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="ntSearch">Search student (name, email, or user_id)</label>
                  <input id="ntSearch" type="text" placeholder="Start typing..." value={ntSearch} onChange={(e) => onNtSearch(e.target.value)} />
                  {ntResults ? (
                    <div className="student-search-results">
                      {ntResults.length === 0 ? (
                        <div className="student-result muted">No students found</div>
                      ) : (
                        ntResults.map((u) => (
                          <div key={u.user_id} className="student-result" onClick={() => void ntSelect(u)}>
                            <div className="sr-name">{studentName(u, u.email)}</div>
                            <div className="sr-meta">{u.email} {u.program_id ? `· ${u.program_id}` : ''}</div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                {ntSelected ? (
                  <div className="form-group">
                    <label>Selected student</label>
                    <div className="selected-pill">
                      <span>{studentName(ntSelected, ntSelected.email)}{ntSelected.email ? ` (${ntSelected.email})` : ''}{ntSelected.program_id ? ` · ${ntSelected.program_id}` : ''}</span>
                      <span className="pill-clear" onClick={() => { setNtSelected(null); setNtSearch(''); setNtCourseItems([]); setNtCourses([]); setNtCourseHint('Select a student first to load their courses.'); }}>&times;</span>
                    </div>
                  </div>
                ) : null}
                <div className="form-group">
                  <label htmlFor="ntManualId">Or paste user_id directly</label>
                  <input id="ntManualId" type="text" placeholder="U_..." value={ntManualId} onChange={(e) => onNtManual(e.target.value)} />
                  <div className="form-hint">Use this if search doesn&apos;t find the student.</div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="ntContext">Thread context</label>
                    <select id="ntContext" value={ntContext} onChange={(e) => setNtContext(e.target.value as 'general' | 'course')}>
                      <option value="general">General</option>
                      <option value="course">Course</option>
                    </select>
                  </div>
                  {ntContext === 'course' ? (
                    <div className="form-group">
                      <label>Course</label>
                      <MultiPicker items={ntCourseItems} selected={ntCourses} placeholder={ntCourseItems.length ? 'Select courses' : 'No courses'} onChange={setNtCourses} />
                      <div className="form-hint">{ntCourseHint}</div>
                    </div>
                  ) : null}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="ntSubject">Subject (optional)</label>
                    <input id="ntSubject" type="text" placeholder="Short title..." value={ntSubject} onChange={(e) => setNtSubject(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ntRefText">Ref text (optional)</label>
                    <input id="ntRefText" type="text" placeholder="Optional reference..." value={ntRefText} onChange={(e) => setNtRefText(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="ntBody">Message</label>
                  <textarea id="ntBody" placeholder="Type your message..." value={ntBody} onChange={(e) => setNtBody(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sm" onClick={() => setNtOpen(false)}>Cancel</button>
                <button type="button" className="btn-action accent" disabled={!ntReady || ntSending} onClick={() => void handleNewThread()}>{ntSendLabel}</button>
              </div>
            </div>
          </div>

          {/* Bulk Send */}
          <div className={`modal-overlay${bulkOpen ? ' open' : ''}`}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bulkTitle">
              <div className="modal-header">
                <h2 id="bulkTitle">Bulk Send Message</h2>
                <button type="button" className="modal-close" onClick={() => setBulkOpen(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Programme</label><MultiPicker items={programs.map((p) => ({ value: p, label: p }))} selected={bkProgrammes} placeholder="All programmes" onChange={pick(setBkProgrammes)} /></div>
                  <div className="form-group"><label>Level</label><MultiPicker items={levels.map((l) => ({ value: l, label: l }))} selected={bkLevels} placeholder="All levels" onChange={pick(setBkLevels)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Cohort</label><MultiPicker items={cohorts.map((c) => ({ value: c, label: c }))} selected={bkCohorts} placeholder="All cohorts" onChange={pick(setBkCohorts)} /></div>
                  <div className="form-group"><label>Subscription Kind</label><MultiPicker items={[{ value: 'PAID', label: 'Paid' }, { value: 'TRIAL', label: 'Trial' }, { value: 'FREE', label: 'Free' }]} selected={bkKinds} placeholder="All kinds" onChange={pick(setBkKinds)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Course entitlement</label><MultiPicker items={courses.map((c) => ({ value: c.course_id, label: c.title }))} selected={bkCourseScopes} placeholder="All courses" onChange={pick(setBkCourseScopes)} /></div>
                  <div className="form-group form-group-end"><button type="button" className="btn-sm" onClick={() => void previewRecipients()}>Preview count</button></div>
                </div>
                {bkPreview !== null ? <div className="preview-count">{bkPreview} recipient{bkPreview !== 1 ? 's' : ''} will receive this message</div> : null}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="bulkContext">Thread context</label>
                    <select id="bulkContext" value={bkContext} onChange={(e) => setBkContext(e.target.value as 'general' | 'course')}>
                      <option value="general">General</option>
                      <option value="course">Course</option>
                    </select>
                  </div>
                  {bkContext === 'course' ? (
                    <div className="form-group">
                      <label htmlFor="bulkCourse">Thread course</label>
                      <select id="bulkCourse" value={bkCourse} onChange={(e) => setBkCourse(e.target.value)}>
                        <option value="">Select course</option>
                        {courses.map((c) => (
                          <option key={c.course_id} value={c.course_id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label htmlFor="bulkSubject">Subject (optional)</label>
                  <input id="bulkSubject" type="text" placeholder="e.g. Exam schedule update" value={bkSubject} onChange={(e) => setBkSubject(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="bulkBody">Message</label>
                  <textarea id="bulkBody" placeholder="Type your message..." value={bkBody} onChange={(e) => setBkBody(e.target.value)} />
                </div>
                {bkPreview !== null && bkPreview > 0 ? (
                  <div className="confirm-box"><strong>Are you sure?</strong> This will send to <span>{bkPreview}</span> students.</div>
                ) : null}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sm" onClick={() => setBulkOpen(false)}>Cancel</button>
                <button type="button" className="btn-action" disabled={bkSending} onClick={() => void handleBulkSend()}>{bkSending ? 'Sending...' : 'Send to all'}</button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
