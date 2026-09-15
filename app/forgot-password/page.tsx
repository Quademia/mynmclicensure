// app/forgot-password/page.tsx — legacy/mynmclicensure/forgot-password.html.

import type { Metadata } from 'next';
import { ForgotForm } from './forgot-form';
import '@/styles/auth.css';

export const metadata: Metadata = {
  title: 'Forgot Password | MyNMCLicensure',
};

export default function ForgotPasswordPage() {
  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Quademia</h1>
          <p>MyNMCLicensure</p>
        </div>

        <h2 className="auth-title">Reset your password</h2>
        <p className="auth-subtitle">Enter your email and we&apos;ll send you a reset link</p>

        <ForgotForm />

        <div className="auth-footer">
          Remembered your password? <a href="/login">Sign in</a>
        </div>
      </div>
    </div>
  );
}
