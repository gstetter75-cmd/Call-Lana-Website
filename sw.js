// Service Worker for Call Lana PWA
// STRATEGY:
//   HTML + JS → Network-first (always get latest code, fallback to cache offline)
//   CSS + Images + Fonts → Cache-first (static assets, fast loading)
//   Supabase API → Skip (let browser handle)
const CACHE_VERSION = 6; // bumped 2026-04-17 — assistant editor, billing checkout, connector honesty patches
const CACHE_NAME = 'calllana-v' + CACHE_VERSION;

// Derive base path from SW scope (works on any deployment URL)
const BASE = new URL('./', self.location).pathname;

// Only cache truly static assets (images, fonts, CSS)
// JS is NOT cached to ensure users always get the latest code after deploys
const STATIC_ASSETS = [
  'css/common.css',
  'css/tailwind.css',
  'css/design.css',
  'logo-nav.png',
  'logo-nav.webp',
  'logo-footer.png',
  'logo-footer.webp',
  'brand_assets/clana-icon-64.png',
  'favicon.svg'
].map(p => BASE + p);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete all old cache versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, Supabase API, and Stripe calls
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase') || url.hostname.includes('stripe')) return;

  const isJS = url.pathname.endsWith('.js');
  const isHTML = event.request.headers.get('accept')?.includes('text/html');
  const isCSS = url.pathname.endsWith('.css');
  const isImage = /\.(png|jpg|jpeg|webp|svg|gif|ico)$/i.test(url.pathname);
  const isFont = /\.(woff2?|ttf|otf)$/i.test(url.pathname);

  // Network-first: HTML and JS (always get latest code)
  if (isHTML || isJS) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful responses for offline fallback
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached =>
            cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          )
        )
    );
    return;
  }

  // Cache-first: CSS, images, fonts (static assets)
  if (isCSS || isImage || isFont) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network only (no caching)
});
