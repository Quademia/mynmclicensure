'use client';

// app/payment-confirmation/pending-recheck.tsx — the confirmation page's
// one moving part while a payment is still being confirmed (2026-09-23).
//
// MyNclex's shape (Sam, 2026-09-23): the SERVER checks the payment while
// it builds the page, so the page arrives already showing the real
// state. This island only asks the server for a fresh page —
// router.refresh() — on the D35 schedule, and draws the waiting card
// while it does. When the payment settles, the server's next page is a
// different state and this island is no longer rendered, so the asking
// stops with it.
//
// The schedule is D35's: every 3 s for the first minute, then every 10 s
// up to three minutes in all; after a refused check (`slow`) the slow
// beat at once. When it runs out the card turns to "We haven't seen your
// payment yet" with Check again, which restarts the whole schedule — the
// Retry ruling (Sam, 2026-09-23). A timeout is not an error: the money is
// safe with Paystack, and the check will find it whenever it is made.
//
// `checkedAt` changes on every server render, which is what re-arms the
// timer after each refresh. The count lives in a ref (written in the
// effect and the handler, never in render — AGENTS.md).

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/shell/icons';
import {
  VERIFY_FAST_POLL_MS,
  VERIFY_FAST_POLLS,
  VERIFY_SLOW_POLL_MS,
  VERIFY_SLOW_POLLS,
} from '@/lib/payments/types';

export function PendingRecheck({
  checkedAt,
  slow,
  supportHref,
}: {
  /** The server's render time; a new value means a fresh check landed. */
  checkedAt: number;
  /** The last check was refused or failed — wait on the slow beat. */
  slow: boolean;
  supportHref: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [gaveUp, setGaveUp] = useState(false);
  const countRef = useRef(0);

  useEffect(() => {
    if (gaveUp) return;
    countRef.current += 1;
    const n = countRef.current;
    const delay = !slow && n <= VERIFY_FAST_POLLS ? VERIFY_FAST_POLL_MS : VERIFY_SLOW_POLL_MS;
    const id = window.setTimeout(() => {
      // The first check was the page load itself, so the schedule's last
      // check is refresh number FAST + SLOW − 1.
      if (n >= VERIFY_FAST_POLLS + VERIFY_SLOW_POLLS) setGaveUp(true);
      else startRefresh(() => router.refresh());
    }, delay);
    return () => window.clearTimeout(id);
  }, [checkedAt, slow, gaveUp, router]);

  function checkAgain() {
    countRef.current = 0;
    setGaveUp(false);
    startRefresh(() => router.refresh());
  }

  if (gaveUp) {
    return (
      <>
        <div className="pcf-head">
          <span className="pcf-icon" aria-hidden="true">
            <Icon name="hourglass" size={22} />
          </span>
          <div className="pcf-head-main">
            <h1 className="pcf-heading">We haven&apos;t seen your payment yet</h1>
            <p className="pcf-body">
              If you approved it, your money is safe with Paystack — it can take a little longer to
              reach us. Check again in a moment.
            </p>
          </div>
          <span className="badge badge-warning pcf-pill">Not confirmed yet</span>
        </div>
        <div className="pcf-actions">
          <button type="button" className="btn btn-accent btn-lg" onClick={checkAgain} disabled={refreshing}>
            {refreshing ? 'Checking…' : 'Check again'}
          </button>
          <a className="btn btn-ghost btn-lg" href={supportHref}>
            Email support
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pcf-head">
        <span className="pcf-icon pcf-spin" aria-hidden="true" />
        <div className="pcf-head-main">
          <h1 className="pcf-heading">Confirming your payment</h1>
          <p className="pcf-body">
            <strong>Keep this page open.</strong> If you are paying by mobile money, approve the
            prompt on your phone — we will pick it up here automatically.
          </p>
        </div>
        <span className="badge badge-warning pcf-pill">Waiting</span>
      </div>
      <p className="pcf-live" role="status" aria-live="polite">
        {refreshing ? 'Checking with Paystack…' : 'Still waiting for Paystack to confirm.'}
      </p>
    </>
  );
}
