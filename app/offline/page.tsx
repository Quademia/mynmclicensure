// app/offline/page.tsx — the offline screen (07.3; Sam, 2026-10-15). The
// one page the phone keeps (public/sw.js): any page of the app opened with
// no signal lands here, one tap from the home-screen icon. It needs no
// sign-in and reads nothing from the server — the packs come from the
// phone itself (offline-packs.tsx) — so it is built once, as a plain file,
// and its copy on the phone opens as it is. Outside the app's chrome, as a
// sitting is: the menu's pages would need the network.

import type { Metadata } from 'next';
import { OfflinePacks } from './offline-packs';
import '@/styles/practice-papers.css';
import '@/styles/student-offline-packs.css';
import '@/styles/runner.css';
import '@/styles/offline-player.css';
import '@/styles/offline.css';

export const metadata: Metadata = {
  title: 'My packs | MyNMCLicensure',
};

export const dynamic = 'force-static';

export default function OfflinePage() {
  return <OfflinePacks />;
}
