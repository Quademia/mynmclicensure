// components/messages/message-us.tsx
//
// "Message us" (08.2; Sam, 2026-10-17): a box on the page the student is
// on, with its label already picked by the place — a course page: that
// course; the sitting's "I don't understand the answer": the course, with
// the question quoted in the draft. A text box and Send: the label's
// open thread is found or made and the message written in one trip
// (msg_student_send), then a toast — "Sent. We'll reply in Messages." —
// and the student stays where they were. Replies are read in Messages.
//
// MessageUsDialog is the box; MessageUsButton is a page's link that opens
// it. On the app's dialog (portalled), so its rules are unscoped (.mu-…).

'use client';

import { useCallback, useState } from 'react';
import { Icon } from '@/components/shell/icons';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { Toast } from '@/lib/toast/toast';
import { sendByLabelAction } from '@/lib/messaging/actions';
import { labelWords, MESSAGE_MAX_LEN, type MessageLabel } from '@/lib/messaging/types';
import '@/styles/message-us.css';

export function MessageUsDialog({
  open,
  onClose,
  label,
  courseId = null,
  courseTitle = null,
  draft = '',
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  label: MessageLabel;
  courseId?: string | null;
  courseTitle?: string | null;
  /** Text the box opens with — the sitting's quoted question. */
  draft?: string;
  /** The caller shows the thank-you itself (the sitting has its own toast); else the box does. */
  onSent?: () => void;
}) {
  const [text, setText] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const dismissSent = useCallback(() => setSent(null), []);

  function close() {
    setText(draft);
    setError(null);
    setSending(false);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const body = text.trim();
    if (!body) return setError('Type your message first.');
    setError(null);
    setSending(true);
    try {
      const r = await sendByLabelAction(label, courseId, body);
      setSending(false);
      if (!r.ok) return setError(r.error);
      setText('');
      if (onSent) onSent();
      else setSent("Sent. We'll reply in Messages.");
      onClose();
    } catch {
      setSending(false);
      setError('Could not send your message. Please check your connection and try again.');
    }
  }

  const about = label === 'course' && courseTitle ? `${labelWords(label)} · ${courseTitle}` : labelWords(label);
  const near = text.length > MESSAGE_MAX_LEN * 0.9;

  return (
    <>
      <BodyPortal>
        <Toast message={sent} tone="success" onDismiss={dismissSent} />
      </BodyPortal>
      <Dialog open={open} onClose={close} title="Message us">
        <form method="post" onSubmit={submit}>
          <p className="mu-about">About: <b>{about}</b></p>
          <label className="dlg-field">
            Your message
            <textarea
              className="dlg-input mu-text"
              value={text}
              maxLength={MESSAGE_MAX_LEN}
              rows={5}
              placeholder="Type your message…"
              autoFocus
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
          </label>
          {near ? <p className="mu-count">{text.length.toLocaleString('en-GB')} / {MESSAGE_MAX_LEN.toLocaleString('en-GB')}</p> : null}
          <p className="mu-note">We reply in Messages.</p>
          {error ? <p className="mu-error" role="alert">{error}</p> : null}
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** A page's "Message us …" link: opens the box with the place's label. */
export function MessageUsButton({
  label,
  courseId = null,
  courseTitle = null,
  className,
  children,
}: {
  label: MessageLabel;
  courseId?: string | null;
  courseTitle?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Icon name="message" />
        {children}
      </button>
      {/* kept mounted, so its thank-you toast outlives the closed box */}
      <MessageUsDialog open={open} onClose={() => setOpen(false)} label={label} courseId={courseId} courseTitle={courseTitle} />
    </>
  );
}
