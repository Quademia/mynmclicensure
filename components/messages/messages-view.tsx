// components/messages/messages-view.tsx — a student's Messages, the one
// piece both sides use (08.2; Sam, 2026-10-17: drawn as B, each course its
// own row): the student on their own page, and Quademia on the admin's
// view of that student — the same rows, the same conversation.
//
// The list is the four plain labels, then the courses, then earlier
// conversations — each row its newest conversation (a Closed chip when
// closed, a dot when the other side's message is unread) or "Start a
// message ›". A tap opens the conversation: its messages and the read
// stamp in one trip; an empty row opens straight onto the compose box,
// and nothing is made until Send, which makes the thread and writes the
// message in one trip. A closed conversation still takes a reply, which
// reopens it with the line "Reopened by a reply.". The other side's
// messages and a close reach an open conversation live (not critical if
// the feed fails). Quademia's side adds Close and Reopen, and opens the
// waiting conversation at once. On the student's own page a send can show
// the notifications' ask under it (08.5b); a notification's tap opens its
// conversation at once, on a phone too.
//
// On a phone the list and the conversation take turns, and the phone's
// back button returns to the list (a history entry, no server trip); on a
// computer they sit side by side. Either way the view fills the space
// left on the screen below the page's own top (Sam, 2026-10-17): only the
// messages scroll, between the conversation's title and the compose bar,
// and on a computer the list scrolls in its own column. The space is
// measured here — the top of the view and the visible height, which a
// phone's keyboard shrinks — and handed to the stylesheet. The actions come in as props — the
// student's or the admin's Server Actions — so this file holds no rule of
// either side.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { NameCircle } from '@/components/shell/name-circle';
import { NotifyAsk } from '@/components/notifications/notify-ask';
import { askAfterSend, type AskShape } from '@/lib/notifications/client';
import { createClient } from '@/lib/supabase/client';
import type { MessagesPageData, MessagesRow } from '@/lib/messaging/page-data';
import { MESSAGE_MAX_LEN, type ActionResult, type Message, type OpenThreadResult, type SendMessageResult } from '@/lib/messaging/types';
import '@/styles/messages-view.css';

type Note = { text: string; tone: 'error' | 'success' } | null;
type Side = 'student' | 'admin';

// The clock, read outside render (react-hooks/purity).
function stampNow(set: (n: number) => void) {
  set(Date.now());
}

function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

function dayLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const n = new Date(now);
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const that = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getUTCFullYear() !== n.getUTCFullYear() ? 'numeric' : undefined, timeZone: 'UTC' });
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

// Text stays text; only http(s) addresses become links, trailing punctuation left outside.
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
    out.push(<a key={k++} href={link} target="_blank" rel="noopener noreferrer">{link}</a>);
    if (tail?.[2]) out.push(tail[2]);
    last = m.index + url.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** What a row with something unread says (Sam, 2026-10-18: B). */
function newWords(side: Side): string {
  return side === 'student' ? 'New reply' : 'New message';
}

function Row({ row, on, side, onOpen }: { row: MessagesRow; on: boolean; side: Side; onOpen: (row: MessagesRow) => void }) {
  return (
    <li>
      <button type="button" className={`smsg-row${on ? ' is-on' : ''}${row.unread ? ' is-unread' : ''}`} onClick={() => onOpen(row)}>
        <span className="smsg-dot" aria-hidden="true" />
        <span className="smsg-row-main">
          <span className="smsg-row-title">
            {row.title}
            {row.status === 'closed' ? <span className="badge badge-neutral smsg-chip">Closed</span> : null}
          </span>
          <span className={row.preview ? 'smsg-row-sub' : 'smsg-row-sub smsg-row-start'}>{row.preview ?? 'Start a message ›'}</span>
        </span>
        {row.when || row.unread ? (
          <span className="smsg-row-end">
            {row.when ? <span className="smsg-row-when">{row.when}</span> : null}
            {row.unread ? <span className="badge smsg-new">{newWords(side)}</span> : null}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * The conversations with something unread, newest first, above the list —
 * shown only when there is one (Sam, 2026-10-18: B; on a phone a course's
 * row can sit below the screen). A tap opens it, as its row does; once
 * read it leaves the card.
 */
function NewCard({ rows, side, onOpen }: { rows: MessagesRow[]; side: Side; onOpen: (row: MessagesRow) => void }) {
  const fresh = rows.filter((r) => r.unread).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  if (!fresh.length) return null;
  return (
    <section className="card smsg-new-card" aria-label={side === 'student' ? 'New replies' : 'New messages'}>
      <h2 className="smsg-new-head">{side === 'student' ? 'New replies' : 'New messages'}</h2>
      <ul className="smsg-new-rows">
        {fresh.map((r) => (
          <li key={r.key}>
            <button type="button" className="smsg-new-row" onClick={() => onOpen(r)}>
              <span className="smsg-row-main">
                <span className="smsg-row-title">{r.title}</span>
                <span className="smsg-row-sub">{r.preview}</span>
              </span>
              {r.when ? <span className="smsg-row-when">{r.when} ›</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MessagesView({
  side,
  student,
  initial,
  initialKey = null,
  openOnPhone = false,
  notify = null,
  openThread,
  sendToThread,
  sendByLabel,
  closeThread,
  reopenThread,
}: {
  side: Side;
  /** The student whose Messages these are: their name circle on their messages. */
  student: { name: string; avatarUrl: string | null };
  initial: MessagesPageData;
  /** A row to open at once (Quademia's side: the waiting conversation; either side: a notification's). */
  initialKey?: string | null;
  /** Open it on a phone too — a notification's tap means that conversation (08.5b). */
  openOnPhone?: boolean;
  /** The student's own page: who they are and the notifications' public key, for the ask after a send (08.5b). */
  notify?: { userId: string; publicKey: string | null } | null;
  openThread: (threadId: string) => Promise<OpenThreadResult>;
  sendToThread: (threadId: string, body: string) => Promise<SendMessageResult>;
  sendByLabel: (label: string, courseId: string | null, body: string) => Promise<SendMessageResult>;
  closeThread?: (threadId: string) => Promise<ActionResult>;
  reopenThread?: (threadId: string) => Promise<ActionResult>;
}) {
  const mine = side; // whose messages sit on the right
  const [data, setData] = useState<MessagesPageData>(initial);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [compose, setCompose] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [note, setNote] = useState<Note>(null);
  const [ask, setAsk] = useState<AskShape>(null);
  const dismiss = useCallback(() => setNote(null), []);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const activeRef = useRef<string | null>(null);
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const rows = [...data.labels, ...data.courses, ...data.earlier];
  const active = activeKey ? rows.find((r) => r.key === activeKey) ?? null : null;

  const patchRow = useCallback((key: string, patch: Partial<MessagesRow>) => {
    const apply = (list: MessagesRow[]) => list.map((r) => (r.key === key ? { ...r, ...patch } : r));
    setData((d) => ({ labels: apply(d.labels), courses: apply(d.courses), earlier: apply(d.earlier) }));
  }, []);

  const toBottom = useCallback(() => {
    window.setTimeout(() => {
      const el = feedRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }, []);

  // The newest message in view once the messages are drawn (a scroll set
  // before the render lands short, as it did on a phone).
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeKey]);

  // ── the live feed on the open conversation ──
  const unsubscribe = useCallback(() => {
    if (!channelRef.current) return;
    try {
      channelRef.current.unsubscribe();
    } catch {
      /* not critical */
    }
    channelRef.current = null;
  }, []);
  useEffect(() => unsubscribe, [unsubscribe]);

  function subscribe(key: string, threadId: string) {
    unsubscribe();
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`smsg-${side}-${threadId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'licensure_gh', table: 'messages', filter: `thread_id=eq.${threadId}` }, async (payload) => {
          const m = payload.new as Partial<Message>;
          if (!m || m.sender_role === mine || activeRef.current !== key) return;
          try {
            const r = await openThread(threadId);
            if (!r.ok || activeRef.current !== key) return;
            setMessages(r.messages);
            stampNow(setNow);
            toBottom();
            if (m.sender_role !== 'system' && m.body_text) {
              const text = m.body_text.replace(/\s+/g, ' ').trim();
              patchRow(key, { preview: side === 'student' ? `Quademia: ${text}` : text, when: 'Just now', at: new Date().toISOString(), unread: false, waiting: side === 'admin' });
            }
          } catch {
            /* it shows on the next open */
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'licensure_gh', table: 'messages_threads', filter: `thread_id=eq.${threadId}` }, (payload) => {
          const t = payload.new as { status?: 'open' | 'closed' };
          if (t?.status) patchRow(key, { status: t.status });
        })
        .subscribe();
      channelRef.current = { unsubscribe: () => supabase.removeChannel(channel) };
    } catch {
      /* the live feed is not critical */
    }
  }

  // ── open and close ──
  async function open(row: MessagesRow) {
    if (activeRef.current === row.key) return;
    if (isPhone() && !activeRef.current) {
      window.history.pushState({ smsg: row.key }, '');
      window.scrollTo(0, 0); // the conversation fills the screen from the page's top
    }
    activeRef.current = row.key;
    setActiveKey(row.key);
    setMessages([]);
    setCompose('');
    setAsk(null);
    stampNow(setNow);
    unsubscribe();
    if (!row.threadId) {
      window.setTimeout(() => composeRef.current?.focus(), 0);
      return;
    }
    setLoading(true);
    try {
      const r = await openThread(row.threadId);
      if (activeRef.current !== row.key) return;
      setLoading(false);
      if (!r.ok) return setNote({ text: r.error, tone: 'error' });
      setMessages(r.messages);
      patchRow(row.key, { status: r.thread.status, unread: false });
      toBottom();
      subscribe(row.key, row.threadId); // the read stamp reaches the badge on its own line (08.5a)
    } catch {
      if (activeRef.current === row.key) setLoading(false);
      setNote({ text: 'Could not open the conversation. Please check your connection and try again.', tone: 'error' });
    }
  }

  const closeConvo = useCallback(() => {
    activeRef.current = null;
    setActiveKey(null);
    setMessages([]);
    setAsk(null);
    unsubscribe();
  }, [unsubscribe]);

  function back() {
    if (window.history.state?.smsg) window.history.back();
    else closeConvo();
  }

  // The space left: where the view starts on the page, and how tall the
  // visible screen is (a phone's keyboard makes it shorter).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      el.style.setProperty('--smsg-top', `${Math.round(top)}px`);
      el.style.setProperty('--smsg-vh', `${Math.round(vh)}px`);
    };
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    const ro = typeof ResizeObserver !== 'undefined' && el.parentElement ? new ResizeObserver(fit) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      ro?.disconnect();
    };
  }, []);

  // The phone's back button returns to the list.
  useEffect(() => {
    function onPop() {
      if (!window.history.state?.smsg && activeRef.current) closeConvo();
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [closeConvo]);

  // Quademia's side opens the waiting conversation at once (on a computer;
  // on a phone the list shows first, as the student's does). A
  // notification's tap opens its conversation on a phone too.
  useEffect(() => {
    if (!initialKey) return;
    const id = window.setTimeout(() => {
      const row = [...initial.labels, ...initial.courses, ...initial.earlier].find((r) => r.key === initialKey);
      if (row && (openOnPhone || !isPhone())) void open(row);
    }, 0);
    return () => window.clearTimeout(id);
    // Runs once, for the page the admin arrived on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── send ──
  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const row = active;
    const text = compose.trim();
    if (!row || !text || sending) return;
    if (text.length > MESSAGE_MAX_LEN) return;
    setSending(true);
    const tempId = 'temp-' + messages.length;
    setMessages((cur) => [...cur, { message_id: tempId, thread_id: row.threadId ?? '', sender_id: 'me', sender_role: mine, body_text: text, created_at: new Date().toISOString() }]);
    setCompose('');
    toBottom();
    const undo = (error: string) => {
      setMessages((cur) => cur.filter((m) => m.message_id !== tempId));
      setCompose(text);
      setNote({ text: error, tone: 'error' });
    };
    try {
      const r = row.threadId ? await sendToThread(row.threadId, text) : await sendByLabel(row.label, row.courseId, text);
      if (!r.ok) {
        undo(r.error);
      } else {
        patchRow(row.key, { threadId: r.thread_id, status: 'open', preview: `You: ${text.replace(/\s+/g, ' ')}`, when: 'Just now', at: new Date().toISOString(), unread: false, waiting: side === 'student' });
        if (r.reopened) {
          const again = await openThread(r.thread_id);
          if (again.ok && activeRef.current === row.key) setMessages(again.messages);
        } else {
          setMessages((cur) => cur.map((m) => (m.message_id === tempId ? { ...m, message_id: r.message_id, thread_id: r.thread_id, created_at: r.at ?? m.created_at } : m)));
        }
        if (!row.threadId) subscribe(row.key, r.thread_id);
        // the ask under the sent message, where it can work and is wanted (08.5b)
        if (notify) setAsk(askAfterSend(notify.userId, notify.publicKey));
        toBottom();
      }
    } catch {
      undo('Could not send the message. Please check your connection and try again.');
    }
    setSending(false);
  }

  // ── Quademia's Close and Reopen ──
  async function setStatus(to: 'open' | 'closed') {
    const row = active;
    const fn = to === 'closed' ? closeThread : reopenThread;
    if (!row?.threadId || !fn || busy) return;
    setBusy(true);
    try {
      const r = await fn(row.threadId);
      if (!r.ok) setNote({ text: r.error, tone: 'error' });
      else {
        patchRow(row.key, { status: to, waiting: to === 'closed' ? false : row.waiting });
        setNote({ text: to === 'closed' ? 'Conversation closed.' : 'Conversation reopened.', tone: 'success' });
      }
    } catch {
      setNote({ text: 'Could not change the conversation. Please check your connection and try again.', tone: 'error' });
    }
    setBusy(false);
  }

  // ── the feed: days, then runs of one side, the reopen line on its own ──
  type Run = { mine: boolean; role: 'student' | 'admin'; items: Message[] };
  const blocks: ({ kind: 'day'; label: string } | { kind: 'line'; m: Message } | { kind: 'run'; run: Run })[] = [];
  let lastDay = '';
  let run: Run | null = null;
  for (const m of messages) {
    const day = dayLabel(m.created_at, now);
    if (day !== lastDay) {
      if (run) blocks.push({ kind: 'run', run });
      run = null;
      blocks.push({ kind: 'day', label: day });
      lastDay = day;
    }
    if (m.sender_role === 'system') {
      if (run) blocks.push({ kind: 'run', run });
      run = null;
      blocks.push({ kind: 'line', m });
      continue;
    }
    const role: Run['role'] = m.sender_role === 'student' ? 'student' : 'admin';
    if (!run || run.role !== role) {
      if (run) blocks.push({ kind: 'run', run });
      run = { mine: role === mine, role, items: [] };
    }
    run.items.push(m);
  }
  if (run) blocks.push({ kind: 'run', run });

  const near = compose.length > MESSAGE_MAX_LEN * 0.9;
  const about = active ? (active.label === 'course' ? active.title : active.title.toLowerCase()) : '';

  return (
    <div ref={rootRef} className={`smsg${active ? ' smsg-open' : ''}`}>
      <Toast message={note?.text ?? null} tone={note?.tone} onDismiss={dismiss} />

      <div className="smsg-grid">
        <section className="smsg-list" aria-label="Conversations">
          <NewCard rows={rows} side={side} onOpen={open} />
          <h2 className="smsg-head">{side === 'student' ? 'What do you need help with?' : 'About'}</h2>
          <ul className="card smsg-rows">
            {data.labels.map((r) => <Row key={r.key} row={r} on={r.key === activeKey} side={side} onOpen={open} />)}
          </ul>
          {data.courses.length ? (
            <>
              <h2 className="smsg-head">{side === 'student' ? 'Your courses' : 'Their courses'}</h2>
              <ul className="card smsg-rows">
                {data.courses.map((r) => <Row key={r.key} row={r} on={r.key === activeKey} side={side} onOpen={open} />)}
              </ul>
            </>
          ) : null}
          {data.earlier.length ? (
            <>
              <h2 className="smsg-head">Earlier conversations</h2>
              <ul className="card smsg-rows">
                {data.earlier.map((r) => <Row key={r.key} row={r} on={r.key === activeKey} side={side} onOpen={open} />)}
              </ul>
            </>
          ) : null}
        </section>

        <section className="card smsg-convo" aria-label="Conversation">
          {!active ? (
            <p className="smsg-pick">{side === 'student' ? 'Choose what your message is about, or open a conversation.' : 'Open a conversation, or start one under a label.'}</p>
          ) : (
            <>
              <div className="smsg-convo-head">
                <button type="button" className="smsg-back" onClick={back}>‹ {side === 'student' ? 'Messages' : 'Their messages'}</button>
                <div className="smsg-convo-top">
                  <h2 className="smsg-convo-title">{active.title}</h2>
                  {side === 'admin' && active.threadId ? (
                    active.status === 'closed' ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void setStatus('open')}>Reopen</button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void setStatus('closed')}>Close</button>
                    )
                  ) : null}
                </div>
                {active.status === 'closed' ? <p className="smsg-closed">This conversation was closed. A reply reopens it.</p> : null}
              </div>

              <div className="smsg-feed" ref={feedRef}>
                {loading ? (
                  <p className="smsg-empty">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="smsg-empty">
                    {side === 'student' ? `Start a message about ${about}. We reply here.` : `Start a message to ${student.name} about ${about}. They read it in Messages.`}
                  </p>
                ) : (
                  blocks.map((b, i) =>
                    b.kind === 'day' ? (
                      <p key={`d${i}`} className="smsg-day"><span>{b.label}</span></p>
                    ) : b.kind === 'line' ? (
                      <p key={b.m.message_id} className="smsg-line">{b.m.body_text}</p>
                    ) : (
                      <div key={`r${i}`} className={`smsg-run ${b.run.mine ? 'smsg-run-mine' : 'smsg-run-theirs'}`}>
                        {b.run.role === 'admin' ? (
                          <NameCircle who="quademia" size="xs" className="smsg-run-who" />
                        ) : (
                          <NameCircle name={student.name} avatarUrl={student.avatarUrl} size="xs" className="smsg-run-who" />
                        )}
                        <div className="smsg-run-items">
                          {b.run.items.map((m) => (
                            <div key={m.message_id} className={`smsg-bubble${m.message_id.startsWith('temp-') ? ' is-sending' : ''}`}>{linkify(m.body_text)}</div>
                          ))}
                          <span className="smsg-time">{clock(b.run.items[b.run.items.length - 1].created_at)}</span>
                        </div>
                      </div>
                    ),
                  )
                )}
                {ask && notify?.publicKey ? (
                  <NotifyAsk shape={ask} userId={notify.userId} publicKey={notify.publicKey} onClose={() => setAsk(null)} />
                ) : null}
              </div>

              <form className="smsg-compose" method="post" onSubmit={send}>
                <textarea
                  ref={composeRef}
                  className="smsg-input"
                  placeholder={active.status === 'closed' ? 'Reply to reopen…' : side === 'student' ? 'Type a message…' : 'Type a reply…'}
                  rows={1}
                  maxLength={MESSAGE_MAX_LEN}
                  value={compose}
                  aria-label="Your message"
                  onChange={(e) => {
                    setCompose(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isPhone()) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button type="submit" className="btn btn-primary" disabled={sending || !compose.trim()}>{sending ? 'Sending…' : 'Send'}</button>
                {near ? <span className="smsg-count">{compose.length.toLocaleString('en-GB')} / {MESSAGE_MAX_LEN.toLocaleString('en-GB')}</span> : null}
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
