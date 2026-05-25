#!/usr/bin/env bun
// TripSync · Bun production server
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

function applySecurityHeaders(res, { cache } = {}) {
    res.headers.set('x-content-type-options', 'nosniff');
    res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    res.headers.set('x-frame-options', 'SAMEORIGIN');
    if (cache) res.headers.set('cache-control', cache);
    return res;
}

function bytesFromAsset(asset) {
    if (asset.kind === 'text') return new TextEncoder().encode(asset.body);
    // base64 → Uint8Array
    const bin = atob(asset.body);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function serveEmbedded(rel, { cache } = {}) {
    const asset = EMBEDDED.get(rel);
    if (!asset) return null;
    const body = bytesFromAsset(asset);
    const res = new Response(body, { headers: { 'content-type': mimeFor(rel) } });
    return applySecurityHeaders(res, { cache });
}

async function serveDisk(rel, { cache } = {}) {
    // `rel` is /-separated; convert each segment for the host filesystem.
    const absPath = nodeJoin(DIST_DIR, ...rel.split('/'));
    const f = file(absPath);
    if (!(await f.exists())) return null;
    const res = new Response(f, { headers: { 'content-type': mimeFor(rel) } });
    return applySecurityHeaders(res, { cache });
}

async function serveIndex() {
    const cache = 'public, max-age=0, must-revalidate';
    return (
        serveEmbedded('index.html', { cache }) ??
        (await serveDisk('index.html', { cache })) ??
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

        // Root → index.html
        if (url.pathname === '/' || url.pathname === '/index.html') {
            return serveIndex();
        }

        const rel = safeRel(url.pathname);
        if (rel) {
            const isAsset = url.pathname.startsWith('/assets/');
            const cache = isAsset
                ? 'public, max-age=31536000, immutable'
                : 'public, max-age=3600';

            const fromEmbed = serveEmbedded(rel, { cache });
            if (fromEmbed) return fromEmbed;

            const fromDisk = await serveDisk(rel, { cache });
            if (fromDisk) return fromDisk;
        }

        // SPA fallback for non-asset routes.
        if (!url.pathname.includes('.')) {
            return serveIndex();
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
console.log(`\n  TripSync · serving ${source} at http://${displayHost}:${server.port}\n`);

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
        console.log(`\n  Received ${sig}, shutting down…`);
        server.stop();
        process.exit(0);
    });
}
