// app/login/page.tsx — the sign-in page (01.12; Sam's layout B,
// 2026-10-30, from the canvas https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU).
//
// One sign-in for students and admins, as before; /router splits them
// after. The frame — the column, and the photo on a computer — is shared
// with register, forgot and reset (components/sign-in/frame.tsx, 01.15).
// The card and its script live in login-card.tsx.

import type { Metadata } from 'next';
import { AppLink } from '@/components/shell/link-pending';
import { SignInFrame, SUPPORT_WHATSAPP, TRIAL_DAYS_FALLBACK } from '@/components/sign-in/frame';
import { getPublicProgrammes } from '@/lib/catalogue/queries';
import { LoginCard } from './login-card';
import { ClearPhonePacks } from './clear-phone-packs';

export const metadata: Metadata = {
  title: 'Sign in | MyNMCLicensure',
};

// Why this browser was sent here. Looked up, never echoed: printing the
// address's words would let anyone put words of their choosing on the
// sign-in page with a link (MyNclex's rule).
const REASONS: Record<string, string> = {
  'other-device':
    'You were signed out because your account was signed in on another device. Sign in again to carry on here.',
  // Registering signs the student straight in (01.15); this is the rare
  // way back when that sign-in could not be made.
  registered: 'Your account is ready. Sign in with the email and password you just chose.',
  // Likewise after a reset (01, item 8).
  reset: 'Your new password is saved. Sign in with it.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;
  const { trialDays } = await getPublicProgrammes();
  const days = trialDays ?? TRIAL_DAYS_FALLBACK;

  return (
    <SignInFrame>
      <header className="si-head">
        <h1>Pick up where you left off.</h1>
        <p>Sign in to your NMC licensure practice.</p>
      </header>

      {notice ? <p className="si-notice">{notice}</p> : null}

      <LoginCard />

      {/* New here? Premium Prep leads, Standard Prep and the trial after
          (Sam, 2026-10-31: B), in the home page's own words. */}
      <div className="si-foot">
        <p>
          New here? <AppLink href="/premium-prep">Get Premium Prep</AppLink>, best for the exam.
        </p>
        <p>
          Or <AppLink href="/subscribe">Standard Prep</AppLink>
          {' · '}
          <AppLink href="/register">Start your {days}-day trial</AppLink>
        </p>
        <p>
          Can&apos;t sign in?{' '}
          <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
            Message us on WhatsApp
          </a>
        </p>
      </div>

      <ClearPhonePacks />
    </SignInFrame>
  );
}
