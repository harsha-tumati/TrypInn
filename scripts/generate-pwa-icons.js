#!/usr/bin/env bun
// scripts/generate-pwa-icons.js
// Renders every raster brand asset from the "folded map" pin mark:
//   icon-192.png, icon-512.png      rounded tile (same art as favicon.svg)
//   icon-maskable-512.png           full-bleed, mark inside the 80% safe zone
//   apple-touch-icon.png (180)      full-bleed — iOS rounds the corners itself
//   og-image.png (1200×630)         social share card
// Uses puppeteer-core with a locally installed Chrome (set CHROME_PATH to override).
// Usage: bun run scripts/generate-pwa-icons.js

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

const PIN = 'M24 44 C21.2 40 12 31.2 12 18 A12 12 0 0 1 36 18 C36 31.2 26.8 40 24 44 Z M19.4 18 A4.6 4.6 0 1 0 28.6 18 A4.6 4.6 0 1 0 19.4 18 Z';
const BG = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#2F4FA8"/><stop offset="1" stop-color="#1E3A8A"/></linearGradient>`;

// The mark in its 48×48 box, scaled so the pin (38 units tall) is `h` px
// tall and centred on (cx, cy).
function mark(cx, cy, h, id = 'pin') {
    const k = h / 38;
    const tx = cx - 24 * k;
    const ty = cy - 25 * k;
    return `<clipPath id="${id}"><path clip-rule="evenodd" d="${PIN}"/></clipPath>
<g transform="translate(${tx} ${ty}) scale(${k})"><g clip-path="url(#${id})">
  <polygon points="0,0 21,0 17,48 0,48" fill="#FFFFFF"/>
  <polygon points="21,0 29,0 26,48 17,48" fill="#FF6B4A"/>
  <polygon points="29,0 48,0 48,48 26,48" fill="#C7D2FE"/>
</g></g>`;
}

const fullBleed = (size, markRatio) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>${BG}</defs><rect width="${size}" height="${size}" fill="url(#bg)"/>${mark(size / 2, size / 2, size * markRatio)}</svg>`;

const fonts = `
@font-face{font-family:'Inter';font-weight:100 900;src:url(${pathToFileURL(join(PUBLIC, 'fonts/Inter-normal-0.woff2'))}) format('woff2')}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(${pathToFileURL(join(PUBLIC, 'fonts/InstrumentSerif-italic-1.woff2'))}) format('woff2')}`;

const ogImage = `<!doctype html><html><head><style>${fonts}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:linear-gradient(135deg,#2F4FA8 0%,#1E3A8A 62%,#162A66 100%);
  font-family:'Inter',sans-serif;color:#fff;position:relative}
.folds{position:absolute;inset:0}
.wrap{position:absolute;left:96px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:26px}
.lockup{display:flex;align-items:center;gap:22px}
.word{font-size:112px;font-weight:800;letter-spacing:-0.05em;line-height:1}
.tag{font-family:'Instrument Serif',serif;font-style:italic;font-size:54px;line-height:1.1;color:#FFE1D9}
.sub{font-size:24px;font-weight:500;color:#C7D2FE;letter-spacing:-0.01em}
</style></head><body>
<svg class="folds" width="1200" height="630" viewBox="0 0 1200 630">
  <polygon points="760,0 900,0 840,630 700,630" fill="#FFFFFF" fill-opacity="0.05"/>
  <polygon points="900,0 1200,0 1200,630 840,630" fill="#000" fill-opacity="0.08"/>
</svg>
<svg style="position:absolute;right:120px;top:95px" width="440" height="440" viewBox="0 0 440 440">${mark(220, 220, 420, 'big')}</svg>
<div class="wrap">
  <div class="lockup">
    <svg width="104" height="104" viewBox="0 0 104 104">${mark(52, 52, 98, 'small')}</svg>
    <span class="word">trypinn</span>
  </div>
  <div class="tag">Plan the world, together.</div>
  <div class="sub">Shared maps · smart itineraries · fair expense splits</div>
</div>
</body></html>`;

const JOBS = [
    { file: 'icon-192.png', size: 192, svg: readFileSync(join(PUBLIC, 'favicon.svg'), 'utf-8'), transparent: true },
    { file: 'icon-512.png', size: 512, svg: readFileSync(join(PUBLIC, 'favicon.svg'), 'utf-8'), transparent: true },
    { file: 'icon-maskable-512.png', size: 512, svg: fullBleed(512, 0.5) },
    { file: 'apple-touch-icon.png', size: 180, svg: fullBleed(180, 0.62) },
    { file: 'og-image.png', width: 1200, height: 630, html: ogImage },
];

const CHROME = process.env.CHROME_PATH || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].find(existsSync);

let puppeteer;
try {
    puppeteer = (await import('puppeteer-core')).default;
} catch {
    console.error('  ✗ puppeteer-core is not installed — run `bun add -d puppeteer-core`.');
    process.exit(1);
}
if (!CHROME) {
    console.error('  ✗ No Chrome found — set CHROME_PATH.');
    process.exit(1);
}

console.log('\n  Rendering brand icons…\n');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
try {
    const page = await browser.newPage();
    for (const job of JOBS) {
        const width = job.width || job.size;
        const height = job.height || job.size;
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        const html = job.html || `<!doctype html><html><body style="margin:0;background:transparent">${job.svg
            .replace(/width="\d+"/, `width="${width}"`)
            .replace(/height="\d+"/, `height="${height}"`)}</body></html>`;
        // Write to disk first so file:// font URLs resolve.
        const tmp = join(PUBLIC, `.render-${job.file}.html`);
        writeFileSync(tmp, html);
        await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
        await page.evaluate(() => globalThis.document.fonts.ready);
        const png = await page.screenshot({ type: 'png', omitBackground: !!job.transparent, clip: { x: 0, y: 0, width, height } });
        writeFileSync(join(PUBLIC, job.file), png);
        unlinkSync(tmp);
        console.log(`  ✓ ${job.file} (${width}×${height}, ${png.length} bytes)`);
    }
} finally {
    await browser.close();
}
