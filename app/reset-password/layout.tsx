// app/reset-password/layout.tsx — the page is a Client Component and so
// cannot export metadata; the title lives here.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | MyNMCLicensure',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
