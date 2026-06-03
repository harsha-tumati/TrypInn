#!/usr/bin/env node
// Download Google Fonts (Inter + Instrument Serif) woff2 files into public/fonts/
// and emit a self-hosted @font-face stylesheet. Keeps only the `latin` subset.
// Inter is a variable font: all weights share one latin woff2, so we emit a
// single @font-face per family/style with a font-weight range.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUT_DIR = path.resolve('public/fonts');
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const sources = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap',
];

function parseLatinFaces(css) {
  const faces = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    if (m[1] !== 'latin') continue;
    const block = m[2];
    faces.push({
      family: /font-family:\s*'([^']+)'/.exec(block)?.[1] || 'font',
      weight: Number(/font-weight:\s*(\d+)/.exec(block)?.[1] || 400),
      style: /font-style:\s*(\w+)/.exec(block)?.[1] || 'normal',
      url: /url\((https:\/\/[^)]+\.woff2)\)/.exec(block)?.[1],
      unicodeRange: /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim() || '',
    });
  }
  return faces;
}

// Collect all latin faces, then group by unique woff2 url.
const all = [];
for (const url of sources) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  all.push(...parseLatinFaces(await res.text()));
}

const groups = new Map(); // url -> {family, style, weights:Set, unicodeRange}
for (const f of all) {
  if (!f.url) continue;
  if (!groups.has(f.url)) groups.set(f.url, { family: f.family, style: f.style, weights: new Set(), unicodeRange: f.unicodeRange });
  groups.get(f.url).weights.add(f.weight);
}

let combined = '';
let i = 0;
for (const [url, g] of groups) {
  const weights = [...g.weights].sort((a, b) => a - b);
  const wMin = weights[0], wMax = weights[weights.length - 1];
  const wDecl = wMin === wMax ? `${wMin}` : `${wMin} ${wMax}`;
  const fname = `${g.family.replace(/\s+/g, '')}-${g.style}-${i++}.woff2`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(OUT_DIR, fname), buf);
  console.log(`  ${fname}  weights=${wDecl} style=${g.style}  (${(buf.length / 1024).toFixed(1)} kB)`);
  combined +=
`@font-face {
  font-family: '${g.family}';
  font-style: ${g.style};
  font-weight: ${wDecl};
  font-display: swap;
  src: url(/fonts/${fname}) format('woff2');
  unicode-range: ${g.unicodeRange};
}
`;
}

await writeFile(path.resolve('public/fonts.css'), combined);
console.log(`\nWrote ${groups.size} woff2 files + public/fonts.css`);
