import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/base.css';

// The product's look comes from legacy/mynmclicensure/css/style.css
// (rebuild.md §3.2), transcribed into styles/. Inter is the legacy font;
// next/font serves it from this origin instead of the legacy Google
// Fonts @import.
//
// "Quademia", never "QAcademy", in anything a reader sees (AGENTS.md UI
// convention #5).
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MyNMCLicensure | Quademia',
  description:
    'MyNMCLicensure — NMC Ghana licensure exam prep for nursing students. A Quademia product.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
