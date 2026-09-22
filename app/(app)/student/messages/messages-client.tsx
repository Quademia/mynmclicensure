// app/(app)/student/messages/messages-client.tsx
//
// The script block of legacy student/messages.html (slice 12a): the
// inbox (each thread with its label, latest preview, relative time,
// the context and Closed chips, the unread dot when the latest message
// is an unread admin reply), the conversation pane (the label and
// context chip, the pinned reference card for a course or question
// thread, date dividers and grouped bubbles with the avatar on the
// last of a group, links made clickable, the closed banner with "Start
// a new conversation"), the compose bar (800 characters, the count
// past 90%, Enter to send, Shift+Enter for a new line, an optimistic
// bubble), "+ New" with its "What's this about?" form and the reuse
// banner, the deep link from the course page or a runner opening or
// reusing the thread and then clearing the address, and the realtime
// feed on the open thread for an admin reply (not critical if it
// fails, as legacy). After every change the sidebar's badge follows
// through a route refresh.
//
// Changed on the way: the page's bottom-right toast is the shared one
// (UI convention #1); the realtime subscription names this product's
// schema; the reference text's first line reads Quademia (#5).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { NameCircle } from '@/components/shell/name-circle';
import { createClient } from '@/lib/supabase/client';
import { ensureThreadAction, listStudentThreadsAction, markThreadReadAction, sendMessageAction, threadMessagesAction } from '@/lib/messaging/actions';
import { MESSAGE_MAX_LEN, type Message, type StudentThread, type ThreadDeepLink } from '@/lib/messaging/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;
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

// legacy formatRefText: the quoted question, line by line.
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

export function MessagesClient({
  student,
  courses,
  initialThreads,
  deepLink,
}: {
  /** The signed-in student, for their name circle (DS7): photo, else initials. */
  student: { name: string; avatarUrl: string | null };
  courses: CourseBit[];
  initialThreads: StudentThread[];
  deepLink: ThreadDeepLink;
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
  const [newSubject, setNewSubject] = useState('');
  const [reuseBanner, setReuseBanner] = useState(false);
  const reuseTimer = useRef<number | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<string | null>(null);
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null);

  const active = activeId ? threads.find((t) => t.thread_id === activeId) ?? null : null;

  function threadLabel(t: StudentThread | null): string {
    if (!t) return 'Conversation';
    if (t.subject) return t.subject;
    if (t.context_type === 'course' && t.course_id) return courseTitles[t.course_id] || t.course_id;
    if (t.context_type === 'question') return 'Question feedback';
    return 'General';
  }

  async function loadThreads() {
    const list = await listStudentThreadsAction();
    setThreads(list);
    setNow(Date.now());
    router.refresh(); // the sidebar's badge
    return list;
  }

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // ── realtime on the open thread (legacy setupRealtime) ──
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
            if (newMsg && newMsg.sender_role === 'admin' && activeRef.current === threadId) {
              setMessages(await threadMessagesAction(threadId));
              setNow(Date.now());
              window.setTimeout(scrollToBottom, 0);
              await markThreadReadAction(threadId);
              await loadThreads();
            }
          },
        )
        .subscribe();
      channelRef.current = { unsubscribe: () => supabase.removeChannel(channel) };
    } catch {
      /* realtime not critical */
    }
  }

  // ── open / close (legacy openThread / closeConvo) ──
  async function openThread(threadId: string, list?: StudentThread[]) {
    setActiveId(threadId);
    activeRef.current = threadId;
    setNewForm(false);
    hideReuseBanner();
    const source = list ?? threads;
    const thread = source.find((t) => t.thread_id === threadId);

    const msgs = await threadMessagesAction(threadId);
    setMessages(msgs);
    setNow(Date.now());
    window.setTimeout(() => {
      scrollToBottom();
      composeRef.current?.focus();
    }, 0);

    await markThreadReadAction(threadId);
    if (thread?.latest) {
      setThreads((cur) => cur.map((t) => (t.thread_id === threadId && t.latest ? { ...t, latest: { ...t.latest, read_by_user: true } } : t)));
    }
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

  // ── the deep link (legacy handleDeepLink), once, after mount ──
  useEffect(() => {
    const id = window.setTimeout(async () => {
      setNow(Date.now());
      if (!deepLink.course_id && !deepLink.item_id) return;
      const contextType = deepLink.item_id ? 'question' : 'course';
      const result = await ensureThreadAction(contextType, {
        course_id: deepLink.course_id,
        quiz_id: deepLink.quiz_id,
        question_id: deepLink.item_id,
        attempt_id: deepLink.attempt_id,
        subject: deepLink.item_id ? 'Question feedback' : null,
        ref_text: deepLink.ref,
      });
      if (!result.ok) {
        setMsg({ text: 'Could not create conversation.', tone: 'error' });
        return;
      }
      const list = await loadThreads();
      await openThread(result.thread_id, list);
      if (!result.created) showReuseBanner();
      window.history.replaceState({}, '', '/student/messages');
    }, 0);
    return () => window.clearTimeout(id);
    // Runs once, for the address the page arrived with, as the legacy boot did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      read_by_user: true,
      read_by_admin: false,
      created_at: new Date().toISOString(),
    };
    setMessages((cur) => [...cur, optimistic]);
    setCompose('');
    window.setTimeout(scrollToBottom, 0);

    const result = await sendMessageAction(activeId, text);
    if (result.ok) {
      setMessages(await threadMessagesAction(activeId));
      window.setTimeout(scrollToBottom, 0);
      await loadThreads();
    } else {
      setMessages((cur) => cur.filter((m) => m.message_id !== tempId));
      setMsg({ text: 'Could not send message.', tone: 'error' });
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

  // ── "+ New" (legacy startNewThread / confirmNewThread) ──
  async function confirmNewThread() {
    const subject = newSubject.trim() || null;
    setNewForm(false);
    setNewSubject('');
    const result = await ensureThreadAction('general', { subject });
    if (!result.ok) {
      setMsg({ text: 'Could not create conversation.', tone: 'error' });
      return;
    }
    const list = await loadThreads();
    await openThread(result.thread_id, list);
    if (!result.created) showReuseBanner();
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

  // Grouped bubbles with date dividers (legacy renderMessages).
  type Group = { sender: 'student' | 'admin'; items: Message[] };
  const blocks: ({ kind: 'date'; label: string } | { kind: 'group'; group: Group })[] = [];
  let lastDate = '';
  let current: Group | null = null;
  for (const m of messages) {
    const label = formatDateLabel(m.created_at, now);
    const sender: 'student' | 'admin' = m.sender_role === 'student' ? 'student' : 'admin';
    if (label !== lastDate) {
      if (current) blocks.push({ kind: 'group', group: current });
      current = null;
      blocks.push({ kind: 'date', label });
      lastDate = label;
    }
    if (!current || current.sender !== sender) {
      if (current) blocks.push({ kind: 'group', group: current });
      current = { sender, items: [] };
    }
    current.items.push(m);
  }
  if (current) blocks.push({ kind: 'group', group: current });

  const refCard = active
    ? active.context_type === 'question'
      ? (
          <div className="ref-card">
            {active.ref_text ? <RefText raw={active.ref_text} /> : active.course_id ? <><strong>Course:</strong> {courseTitles[active.course_id] || active.course_id}</> : null}
            <div className="ref-hint">Type your feedback below. Please mention what part (stem or option) you&apos;re referring to.</div>
          </div>
        )
      : active.context_type === 'course' && active.course_id
        ? (
            <div className="ref-card"><strong>Course:</strong> {courseTitles[active.course_id] || active.course_id}</div>
          )
        : null
    : null;

  return (
    <div className="smsg">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="msg-container">
        <div className="page-header">
          <h1>Messages</h1>
        </div>

        <div className={`msg-split${activeId ? ' convo-open' : ''}`}>
          {/* Thread list */}
          <div className="thread-list">
            <div className="thread-list-header">
              <h2>Inbox</h2>
              <button type="button" className="btn-new-msg" onClick={() => setNewForm(true)}>+ New</button>
            </div>
            <div className="thread-items">
              {newForm ? (
                <div className="new-thread-form">
                  <label htmlFor="newThreadSubject">What&apos;s this about?</label>
                  <input
                    id="newThreadSubject"
                    type="text"
                    placeholder="e.g. Help with dosage calculations"
                    maxLength={80}
                    autoComplete="off"
                    autoFocus
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubject.trim()) void confirmNewThread();
                      if (e.key === 'Escape') setNewForm(false);
                    }}
                  />
                  <div className="form-actions">
                    <button type="button" className="btn-start" disabled={!newSubject.trim()} onClick={() => void confirmNewThread()}>Start</button>
                    <button type="button" className="btn-cancel" onClick={() => setNewForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {threads.length === 0 && !newForm ? (
                <div className="thread-empty">
                  <h3>No messages yet</h3>
                  <p>If you need help or want to send feedback, start a conversation.</p>
                  <button type="button" className="btn-new-msg" onClick={() => setNewForm(true)}>Start a message</button>
                </div>
              ) : (
                threads.map((t) => {
                  const latest = t.latest;
                  const hasUnread = Boolean(latest && !latest.read_by_user && latest.sender_role === 'admin');
                  return (
                    <div
                      key={t.thread_id}
                      className={`thread-item${t.thread_id === activeId ? ' active' : ''}${hasUnread ? ' unread' : ''}`}
                      onClick={() => void openThread(t.thread_id)}
                    >
                      <div className="t-subject">{threadLabel(t)}</div>
                      <div className="t-preview">{latest ? truncate(latest.body_text, 60) : 'No messages'}</div>
                      <div className="t-meta">
                        {hasUnread ? <span className="unread-dot" /> : null}
                        <span>{latest ? formatTime(latest.created_at, now) : ''}</span>
                        {t.context_type !== 'general' ? <span className="context-chip">{t.context_type}</span> : null}
                        {t.status === 'closed' ? <span className="status-chip closed">Closed</span> : null}
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
                  {active.context_type !== 'general' ? <span className="context-chip">{active.context_type}</span> : null}
                </div>

                {reuseBanner ? (
                  <div className="reuse-banner">
                    <span>You already have an open conversation — we&apos;ve opened it for you.</span>
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

                {isClosed ? (
                  <>
                    <div className="closed-banner">This conversation has been closed by support.</div>
                    <div className="closed-action"><button type="button" onClick={() => setNewForm(true)}>Start a new conversation</button></div>
                  </>
                ) : (
                  <div className="compose-bar">
                    <textarea
                      ref={composeRef}
                      placeholder="Type a message..."
                      rows={1}
                      maxLength={MESSAGE_MAX_LEN}
                      value={compose}
                      onChange={(e) => {
                        setCompose(e.target.value);
                        autoResize(e.target);
                      }}
                      onKeyDown={onComposeKey}
                    />
                    <span className={`char-count ${charClass}`}>{composeLen ? `${composeLen}/${MESSAGE_MAX_LEN}` : ''}</span>
                    <button type="button" className="btn-send" disabled={sending || composeLen === 0 || composeLen > MESSAGE_MAX_LEN} onClick={() => void handleSend()}>
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
