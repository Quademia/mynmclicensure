import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';

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
  // The installed app on an iPhone (07.3): its own window and name. The
  // icon is app/apple-icon.png; the rest of the app's details are
  // app/manifest.ts.
  appleWebApp: { capable: true, title: 'MyNMCLicensure', statusBarStyle: 'default' },
};

// Chrome's own pop-up offering to install the app (07.3) is held back: on
// Android it builds a small app through Google, which Sam's phone blocked
// as unsafe (2026-10-15). My packs says how to add the app to the home
// screen the phone's normal way instead. The offer can come before the
// page wakes, so a line of script catches it first.
const INSTALL_CATCHER = "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();});";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Script id="qd-install-catcher" strategy="beforeInteractive">
          {INSTALL_CATCHER}
        </Script>
      </body>
    </html>
  );
}
