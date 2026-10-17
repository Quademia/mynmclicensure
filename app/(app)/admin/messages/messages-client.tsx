// app/(app)/admin/messages/messages-client.tsx
//
// The admin's Messages (slice 12b's page on 08.2's rules; Sam, 2026-09-18
// and 2026-10-17 — the inbox paged is step 4): the filters bar (a student
// search debounced 300 ms, label and status on the server; "unread only"
// in the browser), the thread list (the student's name and programme, the
// thread's label or course, the preview, the relative time, the Closed
// chip, the unread dot), the conversation pane (the student's name, the
// label, Close thread / Reopen, the course card, the flat feed with date
// dividers, "You (Admin)" on Quademia's lines, the line "Reopened by a
// reply.", links made clickable, the compose bar with Enter to send — a
// closed thread still takes a reply, which reopens it), the realtime feed
// on the open thread for a student's message, and the New Thread dialog
// (student search or a pasted id, one of the five labels, the student's
// courses as a picker for "A course", the message, "Send (N threads)").
// Every write is a Server Action into the database's msg_* functions.
// Bulk Send went (Sam, 2026-09-18: announcements are the broadcast).
// After a change the list reloads and the sidebar's badge follows through
// a route refresh.

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
  closeThreadAction,
  listAdminThreadsAction,
  newThreadAction,
  reopenThreadAction,
  searchStudentsForMessagingAction,
  studentCoursesAction,
} from '@/lib/messaging/admin-actions';
import { EMPTY_ADMIN_FILTERS, type AdminThread, type AdminThreadFilters, type StudentHit, type ThreadUser } from '@/lib/messaging/admin-queries';
import { labelWords, MESSAGE_LABELS, MESSAGE_MAX_LEN, type Message } from '@/lib/messaging/types';

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
  initialThreads,
}: {
  courses: CourseBit[];
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
    if (t.context_type === 'course' && t.course_id) return courseTitles[t.course_id] || t.course_id;
    return labelWords(t.context_type);
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
    try {
      const result = await adminSendMessageAction(activeId, text);
      if (result.ok) {
        setCompose('');
        setMessages(await adminThreadMessagesAction(activeId));
        window.setTimeout(scrollToBottom, 0);
        await loadThreads();
      } else {
        setMsg({ text: result.error, tone: 'error' });
      }
    } catch {
      setMsg({ text: 'Could not send the reply. Please check your connection and try again.', tone: 'error' });
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
  const [ntLabel, setNtLabel] = useState('');
  const [ntCourseItems, setNtCourseItems] = useState<PickItem[]>([]);
  const [ntCourseHint, setNtCourseHint] = useState('Select a student first to load their courses.');
  const [ntCourses, setNtCourses] = useState<string[]>([]);
  const [ntBody, setNtBody] = useState('');
  const [ntSending, setNtSending] = useState(false);

  function openNewThread() {
    setNtOpen(true);
    setNtSearch('');
    setNtResults(null);
    setNtSelected(null);
    setNtManualId('');
    setNtLabel('');
    setNtCourseItems([]);
    setNtCourses([]);
    setNtCourseHint('Select a student first to load their courses.');
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
  const ntReady = Boolean(ntUserId) && Boolean(ntLabel) && Boolean(ntBody.trim()) && (ntLabel !== 'course' || ntCourses.length > 0);
  const ntSendLabel = ntSending ? 'Sending...' : ntLabel === 'course' && ntCourses.length > 1 ? `Send (${ntCourses.length} threads)` : 'Send';

  async function handleNewThread() {
    if (!ntUserId) return;
    if (!ntBody.trim()) {
      setMsg({ text: 'Message cannot be empty.', tone: 'error' });
      return;
    }
    if (ntLabel === 'course' && !ntCourses.length) {
      setMsg({ text: 'Select at least one course.', tone: 'error' });
      return;
    }
    setNtSending(true);
    let result: Awaited<ReturnType<typeof newThreadAction>>;
    try {
      result = await newThreadAction({ userId: ntUserId, label: ntLabel, courseIds: ntCourses, body: ntBody.trim() });
    } catch {
      setNtSending(false);
      setMsg({ text: 'Could not start the conversation. Please check your connection and try again.', tone: 'error' });
      return;
    }
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
          </div>
        </div>

        <div className="filters-bar">
          <input type="text" id="filterSearch" placeholder="Search name or email..." value={searchText} onChange={(e) => onSearchChange(e.target.value)} />
          <select id="filterContext" value={filters.contextType} onChange={(e) => applyFilter({ contextType: e.target.value })}>
            <option value="">All labels</option>
            {MESSAGE_LABELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
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
                      <div className="t-preview">{t.latest ? truncate(t.latest.body_text, 55) : 'No messages'}</div>
                      <div className="t-meta">
                        <span>{t.latest ? formatTime(t.latest.created_at, now) : ''}</span>
                        {t.status === 'closed' ? <span className="badge closed">Closed</span> : null}
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
                    <span className="context-chip">{threadLabel(active)}</span>
                  </div>
                  <div className="convo-actions">
                    {active.status === 'open' ? (
                      <button type="button" className="btn-sm danger" onClick={() => void handleClose()}>Close thread</button>
                    ) : (
                      <button type="button" className="btn-sm" onClick={() => void handleReopen()}>Reopen</button>
                    )}
                  </div>
                </div>

                {active.context_type === 'course' && active.course_id ? (
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
                          if (m.sender_role === 'system') {
                            return <div key={m.message_id} className="feed-system">{m.body_text}</div>;
                          }
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

                {active.status === 'closed' ? <div className="closed-banner">This thread is closed. A reply reopens it.</div> : null}
                <div className="compose-bar">
                    <textarea
                      ref={composeRef}
                      placeholder="Type a reply..."
                      rows={1}
                      maxLength={MESSAGE_MAX_LEN}
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
                    <label htmlFor="ntLabel">About</label>
                    <select id="ntLabel" value={ntLabel} onChange={(e) => setNtLabel(e.target.value)}>
                      <option value="" disabled>Choose one</option>
                      {MESSAGE_LABELS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                  {ntLabel === 'course' ? (
                    <div className="form-group">
                      <label>Course</label>
                      <MultiPicker items={ntCourseItems} selected={ntCourses} placeholder={ntCourseItems.length ? 'Select courses' : 'No courses'} onChange={setNtCourses} />
                      <div className="form-hint">{ntCourseHint}</div>
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label htmlFor="ntBody">Message</label>
                  <textarea id="ntBody" placeholder="Type your message..." maxLength={MESSAGE_MAX_LEN} value={ntBody} onChange={(e) => setNtBody(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sm" onClick={() => setNtOpen(false)}>Cancel</button>
                <button type="button" className="btn-action accent" disabled={!ntReady || ntSending} onClick={() => void handleNewThread()}>{ntSendLabel}</button>
              </div>
            </div>
          </div>

        </div>
      </BodyPortal>
    </div>
  );
}
