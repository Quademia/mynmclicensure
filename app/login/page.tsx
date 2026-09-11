// app/login/page.tsx — legacy/mynmclicensure/login.html.
//
// One login for students and admins, as today; /router splits them
// after. The card and its script live in login-card.tsx.

import type { Metadata } from 'next';
import { LoginCard } from './login-card';
import '@/styles/auth.css';

export const metadata: Metadata = {
  title: 'Login | MyNMCLicensure',
};

export default function LoginPage() {
  return (
    <div className="qa-page">
      <LoginCard />
    </div>
  );
}
