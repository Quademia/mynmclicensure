// app/forgot-password/page.tsx — "Forgot password?" from the sign-in card
// (01.15, Sam 2026-10-31: the sign-in page's look, canvas
// https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU). The words and the
// card change when the link is sent, so both live in forgot-form.tsx.

import type { Metadata } from 'next';
import { SignInFrame, SUPPORT_WHATSAPP } from '@/components/sign-in/frame';
import { ForgotForm } from './forgot-form';

export const metadata: Metadata = {
  title: 'Forgot password | MyNMCLicensure',
};

export default function ForgotPasswordPage() {
  return (
    <SignInFrame>
      <ForgotForm />

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
