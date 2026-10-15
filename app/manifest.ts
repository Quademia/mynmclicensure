// app/manifest.ts — the app a student installs to the home screen (07.3;
// Sam, 2026-10-15). Next serves it at /manifest.webmanifest and links it
// from every page. The icon is the painted Q (public/images, the same
// picture as app/icon.png; 192px made from it for the phone's launcher).
// The icon opens the Dashboard (Sam): /router sends a signed-in student
// there and anyone else to the sign-in page; with no signal the offline
// app shows the packs on the phone instead (public/sw.js). The colours are
// the top bar's white, so the phone's own bar matches it.

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MyNMCLicensure',
    short_name: 'MyNMCLicensure',
    description: 'NMC Ghana licensure exam prep. Your offline packs open here with no signal.',
    start_url: '/router',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/images/quademia-mark-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/images/quademia-mark.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
