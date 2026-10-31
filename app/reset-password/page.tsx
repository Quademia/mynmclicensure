// app/reset-password/page.tsx — where the reset email's link lands
// (01.15, Sam 2026-10-31: the sign-in page's look, canvas
// https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU). The words and the
// card follow the link, so both live in reset-card.tsx; saving signs the
// student in (01, item 8).

import type { Metadata } from 'next';
import { SignInFrame, SUPPORT_WHATSAPP } from '@/components/sign-in/frame';
import { ResetCard } from './reset-card';

export const metadata: Metadata = {
  title: 'Set a new password | MyNMCLicensure',
};

export default function ResetPasswordPage() {
  return (
    <SignInFrame>
      <ResetCard />

      <div className="si-foot">
        <p>
          Can&apos;t sign in?{' '}
          <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
            Message us on WhatsApp
          </a>
        </p>
      </div>
    </SignInFrame>
  );
}
