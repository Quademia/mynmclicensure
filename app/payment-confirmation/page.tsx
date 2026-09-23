// app/payment-confirmation/page.tsx — where Paystack sends the buyer back.
//
// Redesigned 2026-09-23 (Sam) in MyNclex's shape
// (qacademy-mynclex app/(public)/checkout/callback): the SERVER checks
// the payment while it builds this page — verifyPayment(), the same
// check the old page's script called, idempotent and counted per
// payment (D35) — so the page arrives already showing the real outcome,
// even on a phone whose scripts are slow or never load. The only
// browser parts are PendingRecheck (asks for a fresh page on D35's
// schedule while Paystack has not confirmed) and SetupForm (the
// new-buyer form). It replaces a 500-line client page carried from
// legacy.
//
// Five states, one card each: checking; paid with one step left (a new
// email — the setup form); you're in, with the receipt; not seen yet
// (the island's timeout); and a real problem (failed, mismatched, not
// found). No system words reach the buyer — "SETUP_REQUIRED" and
// "VERIFYING" were printed on the old page.
//
// ⚠ NOTHING IS STORED IN THE BROWSER, and there is no reference except
// the one in the address. The old page fell back to a reference kept in
// localStorage and kept the payer's email, phone, programme and setup
// token there — on a shared computer the next person opening the page
// saw the last buyer (found 2026-09-22). Paystack always returns with the
// reference in the address (`reference`, or its older `trxref`), as does
// the admin's setup link (`ref` accepted too, as legacy did). D33's
// fuller fix — the reference yielding status only — waits for D31.
//
// ⚠ A CHECK CAN ACTIVATE. Loading this page runs verify, which on a paid
// payment creates the subscription. That is safe to repeat: activation
// is keyed on the reference and happens once (proven 2026-09-23), which
// is also why MyNclex does exactly this.

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getPrograms } from '@/lib/catalogue/queries';
import { formatMinor } from '@/lib/money/format-minor';
import { verifyPayment } from '@/lib/payments/verify';
import type { VerifyResult } from '@/lib/payments/types';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { PublicFooter } from '@/components/shell/public-footer';
import { Icon } from '@/components/shell/icons';
import type { IconName } from '@/lib/nav/types';
import { PendingRecheck } from './pending-recheck';
import { SetupForm } from './setup-form';
import '@/styles/payment-confirmation.css';

export const metadata: Metadata = {
  title: 'Payment Confirmation | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

const SUPPORT_EMAIL = 'support@quademia.com';

/** The clock, read outside render (AGENTS.md: the React compiler's lint). */
function nowMs(): number {
  return Date.now();
}

function supportHref(reference: string): string {
  const body = reference
    ? `Hi Quademia Support, I need help with my payment. My payment reference is ${reference}.`
    : 'Hi Quademia Support, I need help with my payment.';
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Payment help')}&body=${encodeURIComponent(body)}`;
}

type Tone = 'ok' | 'step' | 'wait' | 'bad';

function Head({
  icon,
  heading,
  body,
  pill,
  pillClass,
}: {
  icon: IconName;
  heading: string;
  body: ReactNode;
  pill: string;
  pillClass: string;
}) {
  return (
    <div className="pcf-head">
      <span className="pcf-icon" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="pcf-head-main">
        <h1 className="pcf-heading">{heading}</h1>
        <p className="pcf-body">{body}</p>
      </div>
      <span className={`badge ${pillClass} pcf-pill`}>{pill}</span>
    </div>
  );
}

/** What was bought, for how much, and the reference to keep. */
function Receipt({
  productName,
  amountMinor,
  currency,
  reference,
  screenshot,
}: {
  productName: string;
  amountMinor: number | null;
  currency: string;
  reference: string;
  screenshot: boolean;
}) {
  return (
    <div className="pcf-receipt">
      <div className="pcf-receipt-title">Your receipt</div>
      <div className="pcf-line">
        <span className="pcf-line-name">{productName}</span>
        {amountMinor != null && currency ? (
          <span className="pcf-line-amount">{formatMinor(amountMinor, currency)}</span>
        ) : null}
      </div>
      <div className="pcf-ref">
        Payment reference <b>{reference}</b>
      </div>
      {screenshot ? (
        <p className="pcf-shot">Take a screenshot of this page — it is your proof of payment.</p>
      ) : null}
    </div>
  );
}

function Problem({ heading, body, reference }: { heading: string; body: string; reference: string }) {
  return (
    <>
      <Head icon="alert" heading={heading} body={body} pill="Needs attention" pillClass="badge-danger" />
      {reference ? (
        <div className="pcf-ref pcf-ref-alone">
          Payment reference <b>{reference}</b>
        </div>
      ) : null}
      <div className="pcf-actions">
        <a className="btn btn-accent btn-lg" href={supportHref(reference)}>
          Email support
        </a>
        <Link className="btn btn-ghost btn-lg" href="/subscribe">
          Back to the packages
        </Link>
      </div>
    </>
  );
}

export default async function PaymentConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string; ref?: string }>;
}) {
  const qs = await searchParams;
  const reference = String(qs.reference || qs.trxref || qs.ref || '').trim();

  const supabase = await createClient();
  const [result, programs, userReply] = await Promise.all([
    reference ? verifyPayment(reference) : Promise.resolve(null as VerifyResult | null),
    getPrograms(supabase),
    supabase.auth.getUser(),
  ]);
  const signedIn = Boolean(userReply.data.user);

  let tone: Tone = 'bad';
  let content: ReactNode;

  if (!reference || !result) {
    content = (
      <Problem
        heading="No payment to show"
        body="This page needs the payment reference Paystack sends you back with. Open it from the link after paying, or contact support."
        reference=""
      />
    );
  } else if (result.ok && result.status === 'ACTIVATED') {
    tone = 'ok';
    content = (
      <>
        <Head
          icon="check-circle"
          heading={result.activation_mode === 'existing_by_ref' ? 'Payment already confirmed' : 'Payment received — you’re in'}
          body={
            signedIn
              ? 'Your courses are open on your dashboard now.'
              : 'Your courses are open. Sign in with your email and password to start.'
          }
          pill="Paid"
          pillClass="badge-success"
        />
        <Receipt
          productName={result.product_name}
          amountMinor={result.amount_minor_expected}
          currency={result.currency}
          reference={result.reference}
          screenshot
        />
        <div className="pcf-actions">
          {signedIn ? (
            <Link className="btn btn-accent btn-lg" href="/student/dashboard">
              Go to your dashboard
            </Link>
          ) : (
            <Link className="btn btn-accent btn-lg" href="/login">
              Sign in
            </Link>
          )}
          <Link className="btn btn-ghost btn-lg" href="/subscribe">
            Buy another package
          </Link>
        </div>
      </>
    );
  } else if (result.ok && result.status === 'SETUP_REQUIRED') {
    tone = 'step';
    content = (
      <>
        <Head
          icon="key"
          heading="Payment received — one step left"
          body="Set your name and a password to create your account. Your package starts the moment you do."
          pill="Set up your account"
          pillClass="badge-info"
        />
        <Receipt
          productName={result.product_name}
          amountMinor={result.amount_minor_expected}
          currency={result.currency}
          reference={result.reference}
          screenshot={false}
        />
        <SetupForm
          reference={result.reference}
          setupToken={result.setup_token}
          email={result.email}
          phone={result.phone_number}
          programId={result.program_id}
          programs={programs.map((p) => ({ id: p.program_id, name: p.program_name || p.program_id }))}
        />
      </>
    );
  } else if (
    !result.ok &&
    (result.error === 'not_ready' ||
      result.error === 'rate_limited' ||
      result.error === 'limiter_unavailable' ||
      result.error === 'verify_failed')
  ) {
    // Waiting. A refused or failed check is not a failed payment (D35):
    // Paystack could not be asked just now, so wait on the slow beat.
    tone = 'wait';
    content = (
      <>
        <PendingRecheck
          checkedAt={nowMs()}
          slow={result.error !== 'not_ready'}
          supportHref={supportHref(reference)}
        />
        <div className="pcf-ref pcf-ref-alone">
          Payment reference <b>{reference}</b>
        </div>
      </>
    );
  } else if (!result.ok && result.error === 'payment_not_found') {
    content = (
      <Problem
        heading="We couldn’t find this payment"
        body="The reference in this link does not match a payment. Check the link, or contact support with it."
        reference={reference}
      />
    );
  } else if (!result.ok && result.error === 'payment_failed') {
    content = (
      <Problem
        heading="This payment couldn’t be completed"
        body="It was not activated. If money left your account, contact support with the reference below and we will sort it out — otherwise you can try again from the packages."
        reference={reference}
      />
    );
  } else {
    // amount_mismatch, currency_mismatch, missing_reference: money may
    // have moved but not as ordered — a person must look at it.
    content = (
      <Problem
        heading="We need to check this payment"
        body="The payment did not match the order, so it was not activated. Contact support with the reference below and we will sort it out."
        reference={reference}
      />
    );
  }

  return (
    <div className="pcf-page">
      <PublicTopBar />
      <main className="pcf">
        <div className={`card pcf-card pcf-tone-${tone}`}>{content}</div>
        {tone === 'wait' || tone === 'step' ? (
          <p className="pcf-help">
            Need help? <a href={supportHref(reference)}>Email {SUPPORT_EMAIL}</a> with your payment
            reference.
          </p>
        ) : null}
      </main>
      <PublicFooter />
    </div>
  );
}
