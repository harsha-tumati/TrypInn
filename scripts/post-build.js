import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createBrotliCompress, createGzip } from 'zlib';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream } from 'fs';

const distDir = path.resolve('dist');
const htmlPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// ── Collect the bundled stylesheet(s) ──
const cssLinkRegex = /<link rel="stylesheet" crossorigin href="\/assets\/([^"]+)">/g;
const cssLinks = [];
let match;
while ((match = cssLinkRegex.exec(html)) !== null) {
  cssLinks.push({ full: match[0], filename: match[1] });
}

let fullCSS = '';
for (const { filename } of cssLinks) {
  const cssPath = path.join(distDir, 'assets', filename);
  if (!fs.existsSync(cssPath)) continue;
  // vendor-react CSS (react-datepicker) is only used inside the lazy modal.
  if (filename.startsWith('vendor-react-')) continue;
  fullCSS += fs.readFileSync(cssPath, 'utf-8') + '\n';
}

// ── Split the stylesheet into "critical" (used by the prerendered homepage) and
// "rest" (other routes' styles, loaded after hydration for client navigation).
// The homepage is fully prerendered, so every class it uses — including
// below-the-fold sections — is present in the HTML and stays inlined. Only
// rules for OTHER pages are deferred, which is what shrinks the document and
// speeds up First Contentful Paint. Classes toggled at runtime on the homepage
// (and so absent from the static HTML) are safelisted so they never flash.
const usedClasses = new Set();
for (const m of html.matchAll(/class="([^"]*)"/g)) {
  for (const c of m[1].split(/\s+/)) if (c) usedClasses.add(c);
}
const RUNTIME_SAFELIST = [
  'is-in', 'hide-scrollbar', 'navbar-scrolled', 'spinner', 'spinner-sm',
  'active', 'open', 'selected', 'is-past',
];
for (const c of RUNTIME_SAFELIST) usedClasses.add(c);

// The homepage renders some UI only after hydration (the trip list, the empty
// state, the plan-a-trip modal, the AI chat panel), so those classes are absent
// from the static HTML yet are still homepage-critical. Treat the homepage
// component namespaces as critical by prefix so nothing on "/" can flash
// unstyled (which would race the a11y/contrast audit). Genuinely other-route
// CSS (planner/itinerary/expenses/polls/members/blog/login/trip-detail) keeps
// its own prefixes and stays deferred.
// Only the namespaces that are VISIBLE on first load of "/" (so they're part of
// the a11y/contrast snapshot): the homepage sections, the nav, the hero search,
// and the trip-list loading/empty state. Interaction-only UI (the plan-a-trip
// modal, the AI chat panel) is NOT visible during the audit and is styled by the
// deferred sheet, which has loaded by the time a user opens it.
const HOMEPAGE_PREFIXES = [
  'hp-', 'navbar', 'location-input', 'place-chip', 'place-chips', 'spinner',
];
function classNeeded(c) {
  return usedClasses.has(c) || HOMEPAGE_PREFIXES.some((p) => c.startsWith(p));
}

// Brace-aware split into top-level blocks (handles nested @media).
function splitTopLevel(css) {
  const out = [];
  let depth = 0, buf = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    buf += ch;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { out.push(buf); buf = ''; } }
    else if (ch === ';' && depth === 0) { out.push(buf); buf = ''; }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

// Keep a style rule if any of its comma-separated selectors is needed: pure
// tag/pseudo selectors (no class/id) always stay; class/id selectors stay only
// when at least one referenced class is used on the homepage.
function selectorIsNeeded(sel) {
  const classes = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  if (classes.length === 0) return true; // tag/universal/:root/pseudo-only
  return classes.some(classNeeded);
}
function ruleIsNeeded(block) {
  const selectorPart = block.slice(0, block.indexOf('{'));
  return selectorPart.split(',').some(selectorIsNeeded);
}

// ── 1) Inline homepage CSS in <head>; defer other-route CSS ──
// The homepage uses deferred hydration, so during load it is a fully static
// page: every rule for content VISIBLE on "/" must be inlined (there is no JS to
// activate a deferred sheet during the audit). We inline the whole homepage
// namespace (matched by prefix above) and defer only other-route styles — those
// elements aren't in the homepage DOM, so deferring them is invisible to the
// page and to the a11y audit, and it shrinks the document for a faster paint.
//
// Cascade order matters: the deferred sheet loads AFTER the inline CSS, so a
// rule that overrides another must end up in the same sheet as (and after) the
// rule it overrides. So @media/@supports blocks are split rule by rule too —
// a phone layout override for a planner class goes to the deferred sheet with
// the planner's base rule, instead of staying inline where the later-loading
// base rule would beat it. A rule that styles both a homepage class and an
// other-route class goes to both sheets, keeping its place in each.
function ruleIsFullyNeeded(block) {
  const selectorPart = block.slice(0, block.indexOf('{'));
  return selectorPart.split(',').every(selectorIsNeeded);
}
const GROUPING_AT_RULE = /^@(media|supports|container|layer)\b/;
function splitCSS(css) {
  let critical = '';
  let rest = '';
  for (const block of splitTopLevel(css)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (GROUPING_AT_RULE.test(trimmed) && trimmed.includes('{')) {
      const open = trimmed.indexOf('{');
      const prelude = trimmed.slice(0, open);
      const inner = splitCSS(trimmed.slice(open + 1, trimmed.lastIndexOf('}')));
      if (inner.critical.trim()) critical += `${prelude}{${inner.critical}}`;
      if (inner.rest.trim()) rest += `${prelude}{${inner.rest}}`;
      continue;
    }
    // Other at-rules (@font-face/@keyframes/@import/@charset) — keep inline.
    if (trimmed.startsWith('@') || !trimmed.includes('{')) { critical += block; continue; }
    if (ruleIsNeeded(trimmed)) critical += block;
    if (!ruleIsFullyNeeded(trimmed)) rest += block;
  }
  return { critical, rest };
}
const { critical: criticalCSS, rest: restCSS } = splitCSS(fullCSS);

const critName = '';
if (cssLinks.length > 0) {
  // Inline homepage CSS (no extra round-trip — faster than an external sheet on
  // throttled mobile, which we measured).
  html = html.replace(cssLinks[0].full, `<style>${criticalCSS}</style>`);
  for (let i = 1; i < cssLinks.length; i++) html = html.replace(cssLinks[i].full, '');
}

let restName = '';
if (restCSS.trim()) {
  const restHash = crypto.createHash('sha256').update(restCSS).digest('hex').slice(0, 8);
  restName = `rest-${restHash}.css`;
  fs.writeFileSync(path.join(distDir, 'assets', restName), restCSS);
  // media="print" keeps it off the critical path; main.jsx flips it to "all"
  // when React boots (on first interaction) so other routes are styled by the
  // time the user navigates to them.
  const link =
    `<link rel="stylesheet" href="/assets/${restName}" media="print" data-rest-css />\n` +
    `  <noscript><link rel="stylesheet" href="/assets/${restName}" /></noscript>`;
  html = html.replace('</head>', `  ${link}\n</head>`);
}

// ── 2) Drop modulepreload hints ──
// React is loaded dynamically on first interaction (deferred hydration), so
// preloading the React/entry chunks would needlessly fetch them during load.
html = html.replace(/\s*<link rel="modulepreload"[^>]*>\n?/g, '');

// ── 3) Write + compress ──
fs.writeFileSync(htmlPath, html);

function compressFile(src, dest, compressor) {
  return new Promise((resolve, reject) => {
    pipeline(createReadStream(src), compressor, createWriteStream(dest), (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

await compressFile(htmlPath, htmlPath + '.gz', createGzip({ level: 9 }));
await compressFile(htmlPath, htmlPath + '.br', createBrotliCompress({ params: { 0: 11 } }));
for (const name of [restName, critName].filter(Boolean)) {
  const rp = path.join(distDir, 'assets', name);
  await compressFile(rp, rp + '.gz', createGzip({ level: 9 }));
  await compressFile(rp, rp + '.br', createBrotliCompress({ params: { 0: 11 } }));
}

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log(`Post-build: inlined ${kb(criticalCSS)} kB homepage CSS, deferred ${kb(restCSS)} kB (${restName || 'none'}).`);
