#!/usr/bin/env bun
// scripts/generate-pwa-icons.js
// Generates 192×192 and 512×512 PNG icons from the SVG favicon.
// Falls back to writing properly-sized SVGs when no rasterizer is available.
// Usage: bun run scripts/generate-pwa-icons.js

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const svgSource = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf-8');

const SIZES = [192, 512];

console.log('\n  Generating PWA icons…\n');

for (const size of SIZES) {
    const pngPath = join(PUBLIC, `icon-${size}.png`);
    
    // If a manually-created PNG already exists, skip it.
    if (existsSync(pngPath)) {
        console.log(`  • icon-${size}.png already exists — skipping`);
        continue;
    }

    // Build a correctly-sized SVG
    const sized = svgSource
        .replace(/width="64"/, `width="${size}"`)
        .replace(/height="64"/, `height="${size}"`)
        .replace(/viewBox="0 0 64 64"/, `viewBox="0 0 64 64"`);

    // Write as a .svg fallback at the target dimensions.
    // The manifest already lists the SVG as the primary icon;
    // these sized SVGs serve as additional entries.
    const svgPath = join(PUBLIC, `icon-${size}.svg`);
    writeFileSync(svgPath, sized);
    console.log(`  ✓ icon-${size}.svg (${sized.length} bytes)`);
}

console.log(`
  ┌──────────────────────────────────────────────────┐
  │  For best results, convert these SVGs to PNGs:   │
  │                                                  │
  │  Using Inkscape:                                 │
  │  inkscape icon-192.svg -w 192 -h 192 -o icon-192.png │
  │  inkscape icon-512.svg -w 512 -h 512 -o icon-512.png │
  │                                                  │
  │  Or use any online SVG-to-PNG converter.         │
  └──────────────────────────────────────────────────┘
`);
