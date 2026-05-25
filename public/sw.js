// TripSync service worker — offline-friendly app shell.
// Conservative by design: same-origin only, network-first for pages, so it
// never serves stale app code while online — it just enables offline + install.
const CACHE = 'tripsync-v2';
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(SHELL))
            .catch(() => {})
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Let cross-origin requests (Google Maps, Firebase, OpenAI, fonts, photos)
    // go straight to the network — never cache or intercept them.
    if (url.origin !== self.location.origin) return;

    // Page navigations: network-first, fall back to the cached shell offline.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put('/index.html', copy));
                    return res;
                })
                .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
        );
        return;
    }

    // Same-origin static assets: cache-first, then network (and cache it).
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
        })
    );
});
