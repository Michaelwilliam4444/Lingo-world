/* LingoWorld service worker — offline shell + content caching.
 *  - Navigations: network-first, fall back to the cached page, then /offline.
 *  - Next static assets & fonts (/_next/static, /icons): cache-first (immutable, hashed).
 *  - Supabase/API: never cached here (the app's OfflineSyncService handles data).
 *  - Parent "Download for offline" posts {type:'PRECACHE', urls} to warm every child screen.
 */
const VERSION = 'lw-v1';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const CORE = ['/', '/offline', '/play', '/who', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== 'lingoworld-audio-v1').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'PRECACHE' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(SHELL).then(async (c) => {
      for (const url of event.data.urls) {
        try {
          const res = await fetch(url, { credentials: 'same-origin' });
          if (res.ok) {
            await c.put(url, res.clone());
            // Also cache the page's JS/CSS chunks so the screen runs offline.
            const html = await res.text();
            const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
            const s = await caches.open(STATIC);
            await Promise.all(assets.map((a) => s.match(a).then((hit) => hit || fetch(a).then((r) => r.ok && s.put(a, r))).catch(() => undefined)));
          }
        } catch (e) { /* keep going */ }
      }
    }));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(woff2?|png|svg|webp)$/.test(url.pathname)) {
    event.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Next.js client-navigation payloads (RSC): network-first, cached copy when offline.
  if (url.searchParams.has('_rsc') || req.headers.get('RSC') === '1') {
    event.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch {
        return (await c.match(req, { ignoreSearch: false })) || Response.error();
      }
    })());
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(url.pathname, res.clone());
        return res;
      } catch {
        const c = await caches.open(SHELL);
        return (await c.match(url.pathname)) || (await c.match('/play')) || (await c.match('/offline')) || Response.error();
      }
    })());
  }
});
