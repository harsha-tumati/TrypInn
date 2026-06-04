#!/usr/bin/env node
// Lighthouse runner — mobile + desktop, prints category scores and failing audits.
// Usage: node scripts/lh.mjs [url] [mobile|desktop|both]
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const url = process.argv[2] || 'http://localhost:4178/';
const which = process.argv[3] || 'both';

const desktopConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
  },
};

function fmt(lhr) {
  const cats = lhr.categories;
  const line = ['performance', 'accessibility', 'best-practices', 'seo']
    .map((k) => `${k}: ${Math.round((cats[k].score ?? 0) * 100)}`)
    .join('  |  ');
  const fails = [];
  for (const key of Object.keys(cats)) {
    for (const ref of cats[key].auditRefs) {
      const a = lhr.audits[ref.id];
      if (!a) continue;
      if (a.scoreDisplayMode === 'binary' || a.scoreDisplayMode === 'numeric') {
        if (a.score !== null && a.score < 1) {
          fails.push(`  [${key}] ${a.id} (${Math.round((a.score ?? 0) * 100)}) — ${a.title}${a.displayValue ? ' · ' + a.displayValue : ''}`);
        }
      }
    }
  }
  return { line, fails: [...new Set(fails)] };
}

async function run(formFactor) {
  const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    const opts = { port: chrome.port, output: 'json', logLevel: 'error' };
    const cfg = formFactor === 'desktop' ? desktopConfig : undefined; // default = mobile
    const result = await lighthouse(url, opts, cfg);
    const { line, fails } = fmt(result.lhr);
    console.log(`\n===== ${formFactor.toUpperCase()} =====`);
    console.log(line);
    if (fails.length) {
      console.log('Failing/partial audits:');
      console.log(fails.join('\n'));
    } else {
      console.log('All audits passing.');
    }
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

if (which === 'both' || which === 'mobile') await run('mobile');
if (which === 'both' || which === 'desktop') await run('desktop');
