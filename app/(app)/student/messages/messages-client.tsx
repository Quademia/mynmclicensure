// app/(app)/student/messages/messages-client.tsx
//
// The student's Messages (slice 12a's page on 08.2's rules; Sam,
// 2026-09-18 and 2026-10-17 — its redesign is step 3): the inbox (each
// thread by its label or course, the latest preview, the relative time,
// the Closed chip, the unread dot when Quademia's last reply is unread),
// the conversation pane (the label, the course card for a course thread,
// date dividers and grouped bubbles with the avatar on the last of a
// group, links made clickable, the line "Reopened by a reply." between
// them), the compose bar (2,000 characters, the count past 90%, Enter to
// send, Shift+Enter for a new line, an optimistic bubble), and "+ New"
// with its "What is your message about?" — one of the five labels, and
// the course for "A course" — which opens the label's open thread or a
// new one. A closed thread still takes a reply, which reopens it. Every
// write is a Server Action into the database's msg_* functions; the
// realtime feed on the open thread brings a reply or a close without a
// refresh (not critical if it fails). After every change the sidebar's
// badge follows through a route refresh.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { NameCircle } from '@/components/shell/name-circle';
import { PageHeader } from '@/components/shell/page-header';
import { createClient } from '@/lib/supabase/client';
import { listStudentThreadsAction, markThreadReadAction, openLabelThreadAction, sendMessageAction, threadMessagesAction } from '@/lib/messaging/actions';
import { labelWords, MESSAGE_LABELS, MESSAGE_MAX_LEN, type Message, type StudentThread } from '@/lib/messaging/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;

// The clock, read outside render (react-hooks/purity): the relative times
// and date labels are computed from the last load.
function stampNow(set: (n: number) => void) {
  set(Date.now());
}
type CourseBit = { course_id: string; title: string };

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

// legacy linkify: the text stays text; only http(s) addresses become
// links, trailing punctuation left outside.
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

export function MessagesClient({
  student,
  courses,
  initialThreads,
}: {
  /** The signed-in student, for their name circle (DS7): photo, else initials. */
  student: { name: string; avatarUrl: string | null };
  courses: CourseBit[];
  initialThreads: StudentThread[];
}) {
  const router = useRouter();
  const courseTitles: Record<string, string> = {};
  for (const c of courses) courseTitles[c.course_id] = c.title;

  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  const [threads, setThreads] = useState<StudentThread[]>(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [now, setNow] = useState(0);
  const [compose, setCompose] = useState('');
  const [sending, setSending] = useState(false);
  const [newForm, setNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [starting, setStarting] = useState(false);
  const [reuseBanner, setReuseBanner] = useState(false);
  const reuseTimer = useRef<number | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<string | null>(null);
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null);

  const active = activeId ? threads.find((t) => t.thread_id === activeId) ?? null : null;

  function threadLabel(t: StudentThread | null): string {
    if (!t) return 'Conversation';
    if (t.context_type === 'course' && t.course_id) return courseTitles[t.course_id] || t.course_id;
    return labelWords(t.context_type);
  }

  async function loadThreads() {
    const list = await listStudentThreadsAction();
    setThreads(list);
    stampNow(setNow);
    router.refresh(); // the sidebar's badge
    return list;
  }

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // ── realtime on the open thread: a reply, the reopen line, a close ──
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

  function setupRealtime(threadId: string) {
    teardownRealtime();
    try {
      const supabase = createClient();
      const channel = supabase
        .channel('msg-' + threadId)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'licensure_gh', table: 'messages', filter: `thread_id=eq.${threadId}` },
          async (payload) => {
            const newMsg = payload.new as Partial<Message>;
            if (newMsg && newMsg.sender_role !== 'student' && activeRef.current === threadId) {
              setMessages(await threadMessagesAction(threadId));
              stampNow(setNow);
              window.setTimeout(scrollToBottom, 0);
              await markThreadReadAction(threadId);
              await loadThreads();
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'licensure_gh', table: 'messages_threads', filter: `thread_id=eq.${threadId}` },
          (payload) => {
            const row = payload.new as Partial<StudentThread>;
            if (row && row.status) setThreads((cur) => cur.map((t) => (t.thread_id === threadId ? { ...t, status: row.status! } : t)));
          },
        )
        .subscribe();
      channelRef.current = { unsubscribe: () => supabase.removeChannel(channel) };
    } catch {
      /* realtime not critical */
    }
  }

  // ── open / close (legacy openThread / closeConvo) ──
  async function openThread(threadId: string) {
    setActiveId(threadId);
    activeRef.current = threadId;
    setNewForm(false);
    hideReuseBanner();

    const msgs = await threadMessagesAction(threadId);
    setMessages(msgs);
    stampNow(setNow);
    window.setTimeout(() => {
      scrollToBottom();
      composeRef.current?.focus();
    }, 0);

    await markThreadReadAction(threadId);
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

  useEffect(() => teardownRealtime, [teardownRealtime]);

  // The relative times need the clock, read once after mount.
  useEffect(() => {
    const id = window.setTimeout(() => stampNow(setNow), 0);
    return () => window.clearTimeout(id);
  }, []);

  // ── send (legacy handleSend) ──
  async function handleSend() {
    const text = compose.trim();
    if (!text || !activeId || sending) return;
    if (text.length > MESSAGE_MAX_LEN) return;
    setSending(true);

    const tempId = 'temp-' + Date.now();
    const optimistic: Message = {
      message_id: tempId,
      thread_id: activeId,
      sender_id: 'me',
      sender_role: 'student',
      body_text: text,
      created_at: new Date().toISOString(),
    };
    setMessages((cur) => [...cur, optimistic]);
    setCompose('');
    window.setTimeout(scrollToBottom, 0);

    try {
      const result = await sendMessageAction(activeId, text);
      if (result.ok) {
        setMessages(await threadMessagesAction(activeId));
        window.setTimeout(scrollToBottom, 0);
        await loadThreads();
      } else {
        setMessages((cur) => cur.filter((m) => m.message_id !== tempId));
        setCompose(text);
        setMsg({ text: result.error, tone: 'error' });
      }
    } catch {
      setMessages((cur) => cur.filter((m) => m.message_id !== tempId));
      setCompose(text);
      setMsg({ text: 'Could not send your message. Please check your connection and try again.', tone: 'error' });
    }
    setSending(false);
  }

  function onComposeKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // ── "+ New": the label (and the course), then its open thread or a new one ──
  function openNewForm() {
    setNewLabel('');
    setNewCourse('');
    setNewForm(true);
  }

  async function confirmNewThread() {
    if (!newLabel || (newLabel === 'course' && !newCourse) || starting) return;
    setStarting(true);
    try {
      const result = await openLabelThreadAction(newLabel, newLabel === 'course' ? newCourse : null);
      setStarting(false);
      if (!result.ok) {
        setMsg({ text: result.error, tone: 'error' });
        return;
      }
      setNewForm(false);
      await loadThreads();
      await openThread(result.thread_id);
      if (!result.created) showReuseBanner();
    } catch {
      setStarting(false);
      setMsg({ text: 'Could not open the conversation. Please check your connection and try again.', tone: 'error' });
    }
  }

  function showReuseBanner() {
    setReuseBanner(true);
    if (reuseTimer.current) window.clearTimeout(reuseTimer.current);
    reuseTimer.current = window.setTimeout(() => setReuseBanner(false), 6000);
  }
  function hideReuseBanner() {
    setReuseBanner(false);
    if (reuseTimer.current) window.clearTimeout(reuseTimer.current);
  }

  // ── derived ──
  const isClosed = active?.status === 'closed';
  const composeLen = compose.length;
  const charClass = composeLen > MESSAGE_MAX_LEN ? 'over' : composeLen > MESSAGE_MAX_LEN * 0.9 ? 'warn' : '';
  const newReady = Boolean(newLabel) && (newLabel !== 'course' || Boolean(newCourse));

  // Grouped bubbles with date dividers (legacy renderMessages); the
  // reopen line sits between them on its own.
  type Group = { sender: 'student' | 'admin'; items: Message[] };
  const blocks: ({ kind: 'date'; label: string } | { kind: 'system'; m: Message } | { kind: 'group'; group: Group })[] = [];
  let lastDate = '';
  let current: Group | null = null;
  for (const m of messages) {
    const label = formatDateLabel(m.created_at, now);
    if (label !== lastDate) {
      if (current) blocks.push({ kind: 'group', group: current });
      current = null;
      blocks.push({ kind: 'date', label });
      lastDate = label;
    }
    if (m.sender_role === 'system') {
      if (current) blocks.push({ kind: 'group', group: current });
      current = null;
      blocks.push({ kind: 'system', m });
      continue;
    }
    const sender: 'student' | 'admin' = m.sender_role === 'student' ? 'student' : 'admin';
    if (!current || current.sender !== sender) {
      if (current) blocks.push({ kind: 'group', group: current });
      current = { sender, items: [] };
    }
    current.items.push(m);
  }
  if (current) blocks.push({ kind: 'group', group: current });

  const refCard =
    active && active.context_type === 'course' && active.course_id ? (
      <div className="ref-card"><strong>Course:</strong> {courseTitles[active.course_id] || active.course_id}</div>
    ) : null;

  return (
    <div className="smsg">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="msg-container">
        <PageHeader title="Messages" />

        <div className={`msg-split${activeId ? ' convo-open' : ''}`}>
          {/* Thread list */}
          <div className="thread-list">
            <div className="thread-list-header">
              <h2>Inbox</h2>
              <button type="button" className="btn-new-msg" onClick={openNewForm}>+ New</button>
            </div>
            <div className="thread-items">
              {newForm ? (
                <div className="new-thread-form">
                  <label htmlFor="newThreadLabel">What is your message about?</label>
                  <select id="newThreadLabel" value={newLabel} autoFocus onChange={(e) => setNewLabel(e.target.value)}>
                    <option value="" disabled>Choose one</option>
                    {MESSAGE_LABELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  {newLabel === 'course' ? (
                    <>
                      <label htmlFor="newThreadCourse">Which course?</label>
                      <select id="newThreadCourse" value={newCourse} onChange={(e) => setNewCourse(e.target.value)}>
                        <option value="" disabled>Choose a course</option>
                        {courses.map((c) => (
                          <option key={c.course_id} value={c.course_id}>{c.title}</option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  <div className="form-actions">
                    <button type="button" className="btn-start" disabled={!newReady || starting} onClick={() => void confirmNewThread()}>
                      {starting ? 'Opening…' : 'Start'}
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setNewForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {threads.length === 0 && !newForm ? (
                <div className="thread-empty">
                  <h3>No messages yet</h3>
                  <p>If you need help or want to send feedback, start a conversation.</p>
                  <button type="button" className="btn-new-msg" onClick={openNewForm}>Start a message</button>
                </div>
              ) : (
                threads.map((t) => {
                  const latest = t.latest;
                  return (
                    <div
                      key={t.thread_id}
                      className={`thread-item${t.thread_id === activeId ? ' active' : ''}${t.unread ? ' unread' : ''}`}
                      onClick={() => void openThread(t.thread_id)}
                    >
                      <div className="t-subject">{threadLabel(t)}</div>
                      <div className="t-preview">{latest ? truncate(latest.body_text, 60) : 'No messages'}</div>
                      <div className="t-meta">
                        {t.unread ? <span className="unread-dot" /> : null}
                        <span>{latest ? formatTime(latest.created_at, now) : ''}</span>
                        {t.status === 'closed' ? <span className="badge closed">Closed</span> : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Conversation pane */}
          <div className="convo-pane">
            {!active ? (
              <div className="convo-empty">
                <div className="empty-icon">&#9993;</div>
                <div><strong>Select a conversation</strong></div>
                <div>or click <strong>+ New</strong> to start one</div>
              </div>
            ) : (
              <div className="convo-active">
                <div className="convo-header">
                  <button type="button" className="back-btn" onClick={closeConvo}>&#8592;</button>
                  <h3>{threadLabel(active)}</h3>
                </div>

                {reuseBanner ? (
                  <div className="reuse-banner">
                    <span>You already have an open conversation about this — we&apos;ve opened it for you.</span>
                    <button type="button" className="close-banner" title="Dismiss" onClick={hideReuseBanner}>&times;</button>
                  </div>
                ) : null}

                {refCard ? <div className="ref-wrap">{refCard}</div> : null}

                <div className="convo-messages" ref={messagesRef}>
                  {messages.length === 0 ? (
                    <div className="no-messages">No messages yet. Send a message below.</div>
                  ) : (
                    blocks.map((b, i) =>
                      b.kind === 'date' ? (
                        <div key={`d${i}`} className="date-divider"><span>{b.label}</span></div>
                      ) : b.kind === 'system' ? (
                        <div key={b.m.message_id} className="date-divider msg-system"><span>{b.m.body_text}</span></div>
                      ) : (
                        <div key={`g${i}`} className={`msg-group ${b.group.sender}`}>
                          {b.group.items.map((m) => (
                            <div key={m.message_id} className="msg-row">
                              {b.group.sender === 'student' ? (
                                <NameCircle name={student.name} avatarUrl={student.avatarUrl} size="sm" className="msg-avatar" />
                              ) : (
                                <NameCircle who="quademia" size="sm" className="msg-avatar" />
                              )}
                              <div className={`bubble ${b.group.sender}`} style={m.message_id.startsWith('temp-') ? { opacity: 0.7 } : undefined}>
                                {linkify(m.body_text)}
                              </div>
                            </div>
                          ))}
                          <div className="msg-time">{formatTimeShort(b.group.items[b.group.items.length - 1].created_at)}</div>
                        </div>
                      ),
                    )
                  )}
                </div>

                {isClosed ? <div className="closed-banner">This conversation was closed. A reply reopens it.</div> : null}
                <div className="compose-bar">
                  <textarea
                    ref={composeRef}
                    placeholder={isClosed ? 'Reply to reopen…' : 'Type a message...'}
                    rows={1}
                    maxLength={MESSAGE_MAX_LEN}
                    value={compose}
                    onChange={(e) => {
                      setCompose(e.target.value);
                      autoResize(e.target);
                    }}
                    onKeyDown={onComposeKey}
                  />
                  <span className={`char-count ${charClass}`}>{composeLen > MESSAGE_MAX_LEN * 0.9 ? `${composeLen}/${MESSAGE_MAX_LEN}` : ''}</span>
                  <button type="button" className="btn-send" disabled={sending || composeLen === 0 || composeLen > MESSAGE_MAX_LEN} onClick={() => void handleSend()}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
