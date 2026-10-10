// Trypinn service worker v3 — PWA-optimized app shell.
// Network-first for navigations, cache-first for static assets.
// Includes offline fallback, cache-size limits, and navigation preload.

const CACHE = 'trypinn-v4';
const SHELL = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
    '/apple-touch-icon.png',
];

// Maximum number of runtime-cached assets (fonts, images, JS chunks, etc.)
const MAX_RUNTIME_ENTRIES = 80;

// ── Offline fallback HTML ────────────────────────────────────────────
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"/>
<meta name="theme-color" content="#1E3A8A"/>
<title>Offline — Trypinn</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;min-height:100dvh;display:flex;
align-items:center;justify-content:center;background:#F8FAFC;color:#111827;padding:32px;
text-align:center}
.wrap{max-width:380px}
.icon{font-size:56px;margin-bottom:20px;filter:grayscale(0.3)}
h1{font-size:22px;font-weight:600;margin-bottom:10px;letter-spacing:-0.02em}
p{font-size:15px;color:#64748B;line-height:1.6;margin-bottom:28px}
button{background:#1E3A8A;color:#fff;border:none;border-radius:999px;padding:14px 32px;
font-size:15px;font-weight:600;cursor:pointer;transition:filter .2s}
button:hover{filter:brightness(1.15)}
</style>
</head>
<body>
<div class="wrap">
<div class="icon">✈️</div>
<h1>You're offline</h1>
<p>Trypinn needs an internet connection to sync your trips. Check your connection and try again.</p>
<a href="" style="display:inline-block;background:#1E3A8A;color:#fff;border-radius:999px;padding:14px 32px;font-size:15px;font-weight:600;text-decoration:none;">Retry</a>
</div>
</body>
</html>`;

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(SHELL))
            .catch(() => {})
            .then(() => self.skipWaiting())
    );
});

// ── Activate ─────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
            ))
            .then(() => {
                // Enable navigation preload if supported
                if (self.registration.navigationPreload) {
                    return self.registration.navigationPreload.enable();
                }
            })
            .then(() => self.clients.claim())
    );
});

// ── Cache size limiter ───────────────────────────────────────────────
async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
        // Delete oldest entries (FIFO)
        const toDelete = keys.slice(0, keys.length - maxEntries);
        await Promise.all(toDelete.map((k) => cache.delete(k)));
    }
}

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Let cross-origin requests (Google Maps, Firebase, OpenAI, fonts, photos)
    // go straight to the network — never cache or intercept them.
    if (url.origin !== self.location.origin) return;

    // ─── Page navigations: network-first, offline fallback ───────
    if (req.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Use navigation preload response if available
                    const preloadResponse = event.preloadResponse
                        ? await event.preloadResponse
                        : null;
                    const networkResponse = preloadResponse || await fetch(req);

                    // Cache the fresh index.html for offline use
                    const cache = await caches.open(CACHE);
                    cache.put('/index.html', networkResponse.clone());

                    return networkResponse;
                } catch {
                    // Offline — try cached shell, then branded fallback
                    const cached = await caches.match('/index.html')
                        || await caches.match('/');
                    if (cached) return cached;

                    return new Response(OFFLINE_HTML, {
                        status: 200,
                        headers: { 'content-type': 'text/html; charset=utf-8' },
                    });
                }
            })()
        );
        return;
    }

    // ─── Same-origin static assets: cache-first, then network ────
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;

            return fetch(req).then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => {
                        c.put(req, copy);
                        // Keep cache bounded
                        trimCache(CACHE, MAX_RUNTIME_ENTRIES);
                    });
                }
                return res;
            }).catch(() => {
                // For failed asset requests, return whatever we have
                return cached || new Response('', { status: 408 });
            });
        })
    );
});
