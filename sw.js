// Service worker: lets the site open offline after one visit and install to the home screen.
//
// Strategy
//   • Same-origin files (HTML, CSS, JS, icons): NETWORK-FIRST, falling back to the cache when offline or slow.
//     So a deploy is picked up on the next load with no version bump, and new files are cached as they're used.
//   • Versioned CDN files that never change (Firebase SDK at a fixed version, Google font files): CACHE-FIRST.
//   • Google Fonts CSS: stale-while-revalidate.
//   • Everything else – Firestore, Firebase Auth, any other API – is NOT handled here at all, so it always goes
//     straight to the network and is never cached.
//
// Bump VERSION to drop all old caches (e.g. if the Firebase SDK version in js/cloud.js changes).
const VERSION = 'v1';
const SHELL = `mec-shell-${VERSION}`;
const CDN = `mec-cdn-${VERSION}`;

const FIREBASE = 'https://www.gstatic.com/firebasejs/11.10.0'; // keep in sync with js/cloud.js
const SHELL_FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/data.js', 'js/store.js', 'js/cloud.js', 'js/games.js', 'js/ui.js', 'js/speech.js',
  'js/trophies.js', 'js/account.js', 'js/recovery.js', 'js/nickfilter.js', 'js/pwa.js',
  'js/mastery.js', 'js/review.js', 'js/rewards.js', 'js/shop.js', 'js/report.js', 'js/parent.js', 'js/groups.js', 'js/games-extra.js', 'js/data-extra.js', 'js/phonics.js',
];
const CDN_FILES = ['app', 'auth', 'firestore'].map(n => `${FIREBASE}/firebase-${n}.js`);

const isCdnFile = url => url.hostname === 'fonts.gstatic.com'
  || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
const isFontCss = url => url.hostname === 'fonts.googleapis.com' && url.pathname.startsWith('/css');
const cacheFor = url => (url.origin === self.location.origin ? SHELL : CDN);

// Add files one by one, so one missing file (e.g. renamed on another branch) doesn't break the install.
async function addAll(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.all(urls.map(async u => {
    try {
      const res = await fetch(u, { cache: 'no-cache' });
      if (res.ok) await cache.put(u, res);
    } catch {}
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(Promise.all([addAll(SHELL, SHELL_FILES), addAll(CDN, CDN_FILES)]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, CDN]);
    await Promise.all((await caches.keys()).filter(k => k.startsWith('mec-') && !keep.has(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The page sends the list of files it actually loaded (see js/pwa.js), so fonts and any new modules are
// available offline after the very first visit too.
self.addEventListener('message', event => {
  if (event.data?.type !== 'cache-urls' || !Array.isArray(event.data.urls)) return;
  const byCache = { [SHELL]: [], [CDN]: [] };
  for (const raw of event.data.urls.slice(0, 300)) {
    let url;
    try { url = new URL(raw, self.location.href); } catch { continue; }
    if (url.origin === self.location.origin || isCdnFile(url) || isFontCss(url)) byCache[cacheFor(url)].push(url.href);
  }
  event.waitUntil((async () => {
    for (const [name, urls] of Object.entries(byCache)) {
      const cache = await caches.open(name);
      const missing = (await Promise.all(urls.map(async u => ((await cache.match(u)) ? null : u)))).filter(Boolean);
      await addAll(name, missing);
    }
    await cacheFontFiles();
  })());
});

// Font files are often served from the browser's memory cache and missing from the page's list, so read them from
// the cached Google Fonts CSS instead (only the Latin and Hebrew subsets the site uses).
async function cacheFontFiles() {
  const cache = await caches.open(CDN);
  const urls = [];
  for (const req of await cache.keys()) {
    if (!isFontCss(new URL(req.url))) continue;
    const css = await (await cache.match(req)).text();
    for (const [, subset, url] of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{[^}]*?url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
      if (subset === 'latin' || subset === 'hebrew') urls.push(url);
    }
  }
  const missing = (await Promise.all(urls.map(async u => ((await cache.match(u)) ? null : u)))).filter(Boolean);
  await addAll(CDN, missing);
}

const timeout = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(SHELL);
  const net = fetch(req).then(res => {
    if (res.status === 200 && res.type === 'basic') event.waitUntil(cache.put(req, res.clone()));
    return res;
  });
  try {
    return await Promise.race([net, timeout(4000)]);
  } catch {
    const nav = req.mode === 'navigate';
    const hit = (await cache.match(req, { ignoreSearch: nav })) || (nav && (await cache.match('./')));
    if (hit) { net.catch(() => {}); return hit; }
    return net; // nothing cached: keep waiting for the network (or fail like a normal offline request)
  }
}

async function cacheFirst(event) {
  const cache = await caches.open(CDN);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok) event.waitUntil(cache.put(event.request, res.clone()));
  return res;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CDN);
  const hit = await cache.match(event.request);
  const net = fetch(event.request).then(res => {
    if (res.ok) return cache.put(event.request, res.clone()).then(() => res);
    return res;
  });
  if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(event));
  else if (isCdnFile(url)) event.respondWith(cacheFirst(event));
  else if (isFontCss(url)) event.respondWith(staleWhileRevalidate(event));
  // anything else: not handled → straight to the network, never cached
});
