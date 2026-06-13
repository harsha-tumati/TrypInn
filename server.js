#!/usr/bin/env bun
// Trypinn · Bun production server
// Serves the built Vite SPA. When compiled with `bun build --compile`,
// dist/ assets are embedded via ./embedded-assets.js — the binary is self-contained.

import { file, serve } from 'bun';
import { join as nodeJoin, posix } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Use POSIX path semantics for URL <-> manifest key mapping so the
// behaviour is identical on Linux/macOS/Windows (URLs are always /-separated).
const { extname, normalize } = posix;

// --- Embedded asset bundle ------------------------------------------------

let EMBEDDED = new Map();
try {
    const mod = await import('./embedded-assets.js');
    EMBEDDED = mod.ASSETS ?? new Map();
} catch {
    // No embedded bundle (e.g. when running `bun run start` against on-disk dist/).
    // Fall back to filesystem.
}

// --- Config ---------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
// fileURLToPath correctly handles Windows drive letters (e.g. C:\…\dist\).
const DIST_DIR = fileURLToPath(new URL('./dist/', import.meta.url));
const HAS_DIST = existsSync(DIST_DIR);

if (EMBEDDED.size === 0 && !HAS_DIST) {
    console.error('\n  ✗ No embedded assets and no ./dist directory.');
    console.error('    Run `bun run build` (then `bun run start` or `bun run compile`).\n');
    process.exit(1);
}

// --- MIME -----------------------------------------------------------------

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif':  'image/gif',
    '.ico':  'image/x-icon',
    '.xml':  'application/xml; charset=utf-8',
    '.txt':  'text/plain; charset=utf-8',
    '.woff':  'font/woff',
    '.woff2': 'font/woff2',
    '.ttf':   'font/ttf',
    '.otf':   'font/otf',
    '.map':   'application/json; charset=utf-8',
};

function mimeFor(path) {
    return MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

// --- Helpers --------------------------------------------------------------

const SAFE_PATH = /^[A-Za-z0-9._/-]+$/;

function safeRel(rel) {
    // Prevent path traversal; keep '/'-separated keys for the manifest.
    const clean = normalize('/' + rel).slice(1);
    if (!clean || !SAFE_PATH.test(clean)) return null;
    return clean;
}

function notFound(message = 'Not found') {
    return new Response(message, {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
}

function applySecurityHeaders(res, { cache, encoding } = {}) {
    res.headers.set('x-content-type-options', 'nosniff');
    res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    res.headers.set('x-frame-options', 'SAMEORIGIN');
    // Content Security Policy — inline styles (Vite critical CSS + style attrs), self-hosted
    // fonts, and connects to Firebase, Google Maps and OpenAI. No external font origins.
    res.headers.set('content-security-policy', "default-src 'self'; script-src 'self' https://apis.google.com https://accounts.google.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; font-src 'self'; img-src 'self' data: https://images.unsplash.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleusercontent.com https://*.googleapis.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://accounts.google.com https://api.openai.com; frame-src https://accounts.google.com https://*.firebaseapp.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';");
    // Permissions Policy — disable unused browser features
    res.headers.set('permissions-policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), autoplay=(), display-capture=(), encrypted-media=(), fullscreen=(self), picture-in-picture=()');
    // HSTS — only sent over HTTPS connections (ignored over HTTP)
    res.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
    if (cache) res.headers.set('cache-control', cache);
    if (encoding) {
        res.headers.set('content-encoding', encoding);
        res.headers.set('vary', 'Accept-Encoding');
    }
    return res;
}

// Precompressed-asset negotiation. Text assets are emitted with .br/.gz
// siblings at build time; serve the best variant the client accepts.
const ENCODINGS = [
    { ext: '.br', enc: 'br' },
    { ext: '.gz', enc: 'gzip' },
];

function acceptedEncodings(req) {
    const ae = (req.headers.get('accept-encoding') || '').toLowerCase();
    return ENCODINGS.filter((e) => ae.includes(e.enc));
}

function bytesFromAsset(asset) {
    if (asset.kind === 'text') return new TextEncoder().encode(asset.body);
    // base64 → Uint8Array
    const bin = atob(asset.body);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function serveEmbedded(rel, { cache, encodings = [] } = {}) {
    // Prefer a precompressed sibling the client accepts.
    for (const { ext, enc } of encodings) {
        const asset = EMBEDDED.get(rel + ext);
        if (asset) {
            const res = new Response(bytesFromAsset(asset), { headers: { 'content-type': mimeFor(rel) } });
            return applySecurityHeaders(res, { cache, encoding: enc });
        }
    }
    const asset = EMBEDDED.get(rel);
    if (!asset) return null;
    const res = new Response(bytesFromAsset(asset), { headers: { 'content-type': mimeFor(rel) } });
    return applySecurityHeaders(res, { cache });
}

async function serveDisk(rel, { cache, encodings = [] } = {}) {
    // `rel` is /-separated; convert each segment for the host filesystem.
    const absPath = nodeJoin(DIST_DIR, ...rel.split('/'));
    // Prefer a precompressed sibling the client accepts.
    for (const { ext, enc } of encodings) {
        const cf = file(absPath + ext);
        if (await cf.exists()) {
            const res = new Response(cf, { headers: { 'content-type': mimeFor(rel) } });
            return applySecurityHeaders(res, { cache, encoding: enc });
        }
    }
    const f = file(absPath);
    if (!(await f.exists())) return null;
    const res = new Response(f, { headers: { 'content-type': mimeFor(rel) } });
    return applySecurityHeaders(res, { cache });
}

async function serveIndex(encodings = []) {
    const cache = 'public, max-age=0, must-revalidate';
    return (
        serveEmbedded('index.html', { cache, encodings }) ??
        (await serveDisk('index.html', { cache, encodings })) ??
        notFound()
    );
}

// --- Server ---------------------------------------------------------------

const server = serve({
    port: PORT,
    hostname: HOST,
    development: false,

    async fetch(req) {
        const url = new URL(req.url);
        const method = req.method.toUpperCase();

        if (url.pathname === '/api/openai/chat') {
            if (method !== 'POST') {
                return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
            }
            const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500, headers: { 'content-type': 'application/json' } });
            }
            try {
                const body = await req.json();
                const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(body)
                });
                const data = await openaiRes.json();
                return new Response(JSON.stringify(data), {
                    status: openaiRes.status,
                    headers: { 'content-type': 'application/json' }
                });
            } catch (err) {
                console.error('[openai proxy error]', err);
                return new Response(JSON.stringify({ error: 'Failed to proxy request' }), { status: 500, headers: { 'content-type': 'application/json' } });
            }
        }

        if (method !== 'GET' && method !== 'HEAD') {
            return new Response('Method not allowed', {
                status: 405,
                headers: { allow: 'GET, HEAD' },
            });
        }

        // Health probes
        if (url.pathname === '/healthz' || url.pathname === '/_health') {
            return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
        }

        const encodings = acceptedEncodings(req);

        // Root → index.html
        if (url.pathname === '/' || url.pathname === '/index.html') {
            return serveIndex(encodings);
        }

        const rel = safeRel(url.pathname);
        if (rel) {
            // PWA-critical files: sw.js must never be stale, manifest can be short-lived.
            let cache;
            if (rel === 'sw.js') {
                cache = 'no-cache, no-store, must-revalidate';
            } else if (rel === 'manifest.json') {
                cache = 'public, max-age=300';
            } else if (url.pathname.startsWith('/assets/')) {
                cache = 'public, max-age=31536000, immutable';
            } else {
                cache = 'public, max-age=3600';
            }

            // Only use precompressed (.br/.gz) variants for hashed /assets/
            // files. For everything else (sitemap.xml, robots.txt, etc.), serve
            // the uncompressed original — the reverse proxy handles live
            // compression. This avoids issues where the proxy strips the
            // Content-Encoding header but passes raw compressed bytes through.
            const fileEncodings = url.pathname.startsWith('/assets/') ? encodings : [];

            const fromEmbed = serveEmbedded(rel, { cache, encodings: fileEncodings });
            if (fromEmbed) return fromEmbed;

            const fromDisk = await serveDisk(rel, { cache, encodings: fileEncodings });
            if (fromDisk) return fromDisk;
        }

        // SPA fallback for non-asset routes.
        if (!url.pathname.includes('.')) {
            return serveIndex(encodings);
        }

        return notFound();
    },

    error(err) {
        console.error('[server error]', err);
        return new Response('Internal server error', { status: 500 });
    },
});

const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
const source = EMBEDDED.size > 0
    ? `embedded (${EMBEDDED.size} assets)`
    : `disk (./dist)`;
console.log(`\n  Trypinn · serving ${source} at http://${displayHost}:${server.port}\n`);

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
        console.log(`\n  Received ${sig}, shutting down…`);
        server.stop();
        process.exit(0);
    });
}
