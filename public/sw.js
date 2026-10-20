/* public/sw.js — the offline app (07.3; Sam, 2026-10-15: our own small
 * file, as Next.js's own guide does, rather than a library that would store
 * every page's code on every student's phone).
 *
 * It keeps ONE page, /offline (the packs kept on this phone, and the
 * player), with the files that page needs, and shows it when a page of the
 * app cannot be reached. Everything else goes to the network as if this
 * file were not here: a page that answers — even with an error — is shown
 * as it is; only a page that cannot be reached at all becomes /offline.
 * The packs themselves are not here: the page keeps them in the phone's
 * database (lib/offline-packs/phone.ts).
 *
 * Registered by the student and admin pages on a production build only
 * (lib/offline-packs/offline-app.ts). A page asks for a fresh copy of
 * /offline with the message {type: 'warm'} — once a day on a phone holding
 * packs, and at once after a Save — because a release changes its files.
 * The page and its files are swapped together, so the copy on the phone
 * always opens.
 *
 * It also shows the app's notifications (08.5b; Sam, 2026-10-17): a notice
 * arrives sealed from the phone's post office as {title, body, url, tag} —
 * who and the label only, never the message's text — and is shown with the
 * painted Q; one per conversation (the tag), a new one replacing the last.
 * A tap opens the conversation: in an app window already open, else a new
 * one. An announcement (08.15, tag notice-…) also tells any open app window
 * {type: 'notice-arrived'}, so its number and the Announcements list follow
 * without the student leaving the page.
 *
 * Plain JavaScript, served as it is: nothing in the build touches it.
 */

// A new name when this file's way of keeping changes: the old store is
// dropped as the new file takes over.
const SHELL = 'quademia-offline-v1';
const OFFLINE_URL = '/offline';

// What a phone shows when it is offline and has never kept the page.
const FALLBACK_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Offline | MyNMCLicensure</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#111827">' +
  "<h1 style=\"font-size:22px\">You're offline</h1><p>Connect to the internet and try again.</p></body></html>";

self.addEventListener('install', (event) => {
  event.waitUntil(
    warm()
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('quademia-offline-') && k !== SHELL).map((k) => caches.delete(k)));
      // The page's own request starts while this file wakes, so a slow
      // phone does not wait for it first.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'warm') event.waitUntil(warm().catch(() => {}));
});

self.addEventListener('push', (event) => {
  let n = {};
  try {
    n = event.data ? event.data.json() : {};
  } catch {
    n = {};
  }
  const tag = typeof n.tag === 'string' && n.tag ? n.tag : undefined;
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(typeof n.title === 'string' && n.title ? n.title : 'Quademia', {
        body: typeof n.body === 'string' ? n.body : '',
        icon: '/images/quademia-mark-192.png',
        tag,
        renotify: Boolean(tag),
        data: { url: typeof n.url === 'string' && n.url.startsWith('/') ? n.url : '/router' },
      }),
      // an announcement (08.15): an app window open on this device asks its
      // number again, and the Announcements page its list (Sam, 2026-10-20)
      tag && tag.startsWith('notice-')
        ? self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((wins) => wins.forEach((win) => win.postMessage({ type: 'notice-arrived' })))
            .catch(() => {})
        : null,
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/router', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const win of wins) {
        if (new URL(win.url).origin !== self.location.origin) continue;
        try {
          await win.focus();
          if ('navigate' in win) await win.navigate(url);
          return;
        } catch {
          // this window would not take it; a new one below
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(url.pathname === OFFLINE_URL ? offlinePage(event) : page(event));
    return;
  }
  // The offline page's own files, from the phone's copy when it has one
  // (their names change with their contents, so a copy is never stale).
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/images/')) {
    event.respondWith(caches.open(SHELL).then((cache) => cache.match(req)).then((hit) => hit || fetch(req)));
  }
});

/** A page of the app: the network; /offline only when it cannot be reached. */
async function page(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    return Response.redirect(OFFLINE_URL, 302);
  }
}

/** /offline itself: the phone's copy first, so it opens with no signal. */
async function offlinePage(event) {
  if (event.preloadResponse) event.waitUntil(Promise.resolve(event.preloadResponse).catch(() => {}));
  const cache = await caches.open(SHELL);
  const hit = await cache.match(OFFLINE_URL);
  if (hit) return hit;
  try {
    return await fetch(event.request);
  } catch {
    return new Response(FALLBACK_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

/** Fetch /offline and every file it names; keep them together, drop the old ones. */
async function warm() {
  const res = await fetch(OFFLINE_URL, { cache: 'no-store', credentials: 'same-origin' });
  if (!res.ok) return;
  const html = await res.clone().text();
  const files = filesOf(html);
  const cache = await caches.open(SHELL);
  const fetched = await Promise.all(
    files.map(async (file) => {
      if (await cache.match(file)) return null;
      const r = await fetch(file, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('not kept: ' + file);
      return [file, r];
    }),
  );
  for (const pair of fetched) if (pair) await cache.put(pair[0], pair[1]);
  // The app's font is named only inside its stylesheets: keep the one face
  // the page itself uses (Next marks it ".p.woff2"), not every alphabet's.
  const fonts = new Set();
  for (const file of files) {
    if (!file.endsWith('.css')) continue;
    const css = await cache.match(file);
    const text = css ? await css.text() : '';
    for (const m of text.matchAll(/\/_next\/static\/media\/[A-Za-z0-9_.-]+\.p\.woff2/g)) fonts.add(m[0]);
  }
  for (const font of fonts) {
    if (await cache.match(font)) continue;
    const r = await fetch(font, { credentials: 'same-origin' });
    if (r.ok) await cache.put(font, r);
  }
  await cache.put(OFFLINE_URL, res);
  const keep = new Set([OFFLINE_URL, ...files, ...fonts].map((f) => new URL(f, self.location.origin).href));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
}

/**
 * The files a page needs: its scripts, styles, fonts and pictures — every
 * src= and href= on this site, plus the script chunks the page's own data
 * names (written there as "static/chunks/…", loaded once the page wakes).
 */
function filesOf(html) {
  const out = new Set();
  const attr = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = attr.exec(html))) {
    let url;
    try {
      url = new URL(m[1].replace(/&amp;/g, '&'), self.location.origin);
    } catch {
      continue;
    }
    if (url.origin !== self.location.origin) continue;
    if (url.pathname.startsWith('/_next/static/') || /\.(?:png|jpe?g|svg|webp|ico|woff2?)$/.test(url.pathname)) {
      out.add(url.pathname + url.search);
    }
  }
  const chunk = /static\/(?:chunks|css|media)\/[A-Za-z0-9_.~%()[\]\-/]+?\.(?:js|css|woff2)/g;
  while ((m = chunk.exec(html))) out.add('/_next/' + m[0]);
  return [...out];
}
