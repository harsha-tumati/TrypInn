import fs from 'fs';
import path from 'path';
import { createBrotliCompress, createGzip } from 'zlib';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream } from 'fs';

const distDir = path.resolve('dist');
const htmlPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// ── 1) Extract critical CSS rules and inline them in <head> ──
const criticalSelectors = new Set([
  ':root', 'html', 'body', '*', '*::before', '*::after',
  '.navbar', '.navbar-scrolled', '.navbar-brand', '.navbar-brand-icon',
  '.navbar-brand-name', '.navbar-actions', '.navbar-link', '.navbar-cta',
  '.navbar-profile', '.navbar-avatar', '.navbar-login',
  '.hp', '.hp-hero', '.hp-hero-inner', '.hp-eyebrow', '.hp-h1', '.hp-hl',
  '.hp-sub', '.hp-search', '.hp-search-field', '.hp-search-hint',
  '.hp-search-btn', '.hp-hero-foot', '.hp-textlink', '.hp-trust',
  '.hp-pop', '.hp-pop-1', '.hp-pop-2', '.hp-pop-3', '.hp-pop-4',
  '.hp-deco', '.hp-deco-img', '.hp-deco-emoji',
  '.hp-deco-1', '.hp-deco-2', '.hp-deco-3', '.hp-deco-4',
  '.hp-hero-strip', '.hp-strip-card', '.hp-strip-0', '.hp-strip-1',
  '.hp-strip-2', '.hp-strip-3', '.hp-strip-img', '.hp-strip-emoji',
  '.hp-strip-label', '.hp-blob', '.hp-blob-1', '.hp-blob-2', '.hp-blob-3',
  '.hp-marquee', '.hp-marquee-track', '.hp-marquee-item',
  '@keyframes hp-pop-in', '@keyframes hp-floaty',
  '.hp-stats', '.hp-stats-grid', '.hp-stat', '.hp-stat-big', '.hp-stat-small',
  '.hp-section', '.hp-head', '.hp-kicker', '.hp-h2', '.hp-section-sub',
]);

function extractCriticalCSS(cssText) {
  const criticalRules = [];
  const ruleRegex = /([^{]+)\{([^}]*)\}/g;
  let m;
  while ((m = ruleRegex.exec(cssText)) !== null) {
    const selectors = m[1].trim();
    const body = m[2];
    const selectorList = selectors.split(',').map(s => s.trim().split(/[\s:>+~[]/)[0]);
    const isCritical = selectorList.some(sel => {
      if (selectors.startsWith('@media')) return true;
      if (selectors.startsWith('@keyframes')) return true;
      return criticalSelectors.has(sel);
    });
    if (isCritical) {
      criticalRules.push(`${selectors} {${body}}`);
    }
  }
  return criticalRules.join('\n');
}

// Find all local stylesheet links
const cssLinkRegex = /<link rel="stylesheet" crossorigin href="\/assets\/([^"]+)">/g;
const cssLinks = [];
let match;
while ((match = cssLinkRegex.exec(html)) !== null) {
  cssLinks.push({ full: match[0], filename: match[1] });
}

let allCriticalCSS = '';
let fullCSS = '';
for (const { full, filename } of cssLinks) {
  const cssPath = path.join(distDir, 'assets', filename);
  if (!fs.existsSync(cssPath)) continue;
  const css = fs.readFileSync(cssPath, 'utf-8');
  const critical = extractCriticalCSS(css);
  allCriticalCSS += `/* ${filename} */\n${critical}\n`;
  // Skip vendor-react CSS (react-datepicker) — it's not needed for the initial shell
  if (!filename.startsWith('vendor-react-')) {
    fullCSS += `/* ${filename} */\n${css}\n`;
  }
  console.log(`Extracted ${(critical.length / 1024).toFixed(1)} kB critical from ${filename}`);
}

// Replace the first stylesheet link with inline critical CSS
if (cssLinks.length > 0) {
  html = html.replace(cssLinks[0].full, `<style>${allCriticalCSS}</style>`);
  // Remove remaining links (their CSS will go at end of body)
  for (let i = 1; i < cssLinks.length; i++) {
    html = html.replace(cssLinks[i].full, '');
  }
}

// ── 2) Keep modulepreload links for critical chunks ──
const criticalChunks = ['vendor-react', 'vendor-router'];
const preloadLinks = [];
for (const chunk of criticalChunks) {
  const m = html.match(new RegExp(`<link rel="modulepreload"[^>]*${chunk}[^>]*>`));
  if (m) preloadLinks.push(m[0]);
}

// Remove ALL modulepreload links first, then re-add only critical ones
html = html.replace(/\s*<link rel="modulepreload"[^>]*>\n?/g, '');
if (preloadLinks.length > 0) {
  html = html.replace(
    /(<script type="module"[^>]*><\/script>)/,
    `$1\n${preloadLinks.join('\n')}`
  );
}

// ── 3) Inject full CSS at end of <body> ──
// The critical CSS in <head> covers above-fold content; the full CSS
// loads at the end to avoid render-blocking for below-fold content.
html = html.replace('</body>', `  <style>${fullCSS}</style>\n  </body>`);

fs.writeFileSync(htmlPath, html);

// ── 4) Compress index.html ──
function compressFile(src, dest, compressor) {
  return new Promise((resolve, reject) => {
    pipeline(createReadStream(src), compressor, createWriteStream(dest), (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

await compressFile(htmlPath, htmlPath + '.gz', createGzip({ level: 9 }));
await compressFile(htmlPath, htmlPath + '.br', createBrotliCompress({ params: { 0: 4 } }));

console.log('Post-build: critical CSS inlined, full CSS deferred.');
