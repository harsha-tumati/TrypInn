#!/usr/bin/env node
/**
 * Pre-build the trip plans that sit behind "Get estimate" and "Generate
 * itinerary" on every travel guide.
 *
 * Building a plan on demand means an OpenAI round trip per reader per blog.
 * Instead we resolve every blog to a destination once, build one plan per
 * destination, and serve it as a static file. 1050 blogs collapse to ~200
 * plans because a hundred "Solo Travel in Egypt"-style posts all point at the
 * same Egypt plan.
 *
 * Places come from two sources, in order of preference:
 *   1. public/must-visits/*.json — curated, with real photos and durations.
 *      Free, and better than anything a model will write. Covers India.
 *   2. OpenAI (gpt-4o-mini) for everywhere else, cached in
 *      scripts/.trip-plan-cache.json so the weekly refresh does not re-pay for
 *      places that have not changed.
 *
 * Cost estimates are computed locally from scripts/trip-plans/cost-model.js —
 * no API needed, so they refresh even with no key present.
 *
 * Output:
 *   public/trip-plans/index.json        manifest (counts, generatedAt)
 *   public/trip-plans/by-blog.json      blogId -> planId, for tooling/debug
 *   public/trip-plans/plans/<id>.json   one file per plan
 *   public/blogs/content/<id>.json      gains a `planId` field, so the blog
 *                                       page needs no extra lookup request
 *
 * Usage:
 *   bun run scripts/generate-trip-plans.js              # weekly refresh
 *   bun run scripts/generate-trip-plans.js --force      # re-fetch all places
 *   bun run scripts/generate-trip-plans.js --no-ai      # curated data only
 *   bun run scripts/generate-trip-plans.js --dist       # also write to dist/
 *
 * Env:
 *   OPENAI_API_KEY (or VITE_OPENAI_API_KEY)  required for non-curated places
 *   PLACES_TTL_DAYS   default 90. Cost estimates refresh every run regardless;
 *                     place lists are expensive and barely change week to week,
 *                     and reshuffling them weekly would make recommendations
 *                     look random. --force overrides.
 */
import fs from 'fs';
import path from 'path';

import { buildEstimate } from './trip-plans/cost-model.js';
import { COLLECTIONS, NO_PLAN, MUST_VISIT_ALIASES, EXTRA_DESTINATIONS } from './trip-plans/collections.js';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'public', 'blogs');
const BLOG_CONTENT = path.join(BLOG_DIR, 'content');
const MV_DIR = path.join(ROOT, 'public', 'must-visits');
const OUT_DIR = path.join(ROOT, 'public', 'trip-plans');
const PLANS_DIR = path.join(OUT_DIR, 'plans');
const CACHE_FILE = path.join(ROOT, 'scripts', '.trip-plan-cache.json');
const DIST_DIR = path.join(ROOT, 'dist', 'trip-plans');

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const NO_AI = args.has('--no-ai');
const WRITE_DIST = args.has('--dist');
const TTL_DAYS = Number(process.env.PLACES_TTL_DAYS || 90);
const API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

// ── Destination catalogue ────────────────────────────────────────────────────

/** Parse DESTS out of generate-blogs.js so there is one source of truth. */
function loadDestinations() {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-blogs.js'), 'utf-8');
    const block = src.split('const DESTS = [')[1].split('\n];')[0];
    const out = [];
    const re = /\{n:'([^']+)',c:'([^']+)',t:\[([^\]]*)\]\}/g;
    let m;
    while ((m = re.exec(block)) !== null) {
        out.push({
            name: m[1],
            country: m[2],
            tags: [...m[3].matchAll(/'([^']*)'/g)].map(x => x[1]),
        });
    }
    if (out.length === 0) throw new Error('Could not parse DESTS from generate-blogs.js');
    // Hand-written posts can cover places the generated catalogue never had.
    for (const extra of EXTRA_DESTINATIONS) {
        if (!out.some(d => d.name === extra.name)) out.push(extra);
    }
    return out;
}

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

/** Strip a leading article so "the Maldives" matches "maldives". */
function bareName(name) {
    return name.replace(/^the\s+/i, '');
}

/**
 * The plan id for a destination name. Two spellings of the same place — the
 * blog list's "Leh Ladakh" and the must-visits "Leh-Ladakh" — have to collapse
 * to one id, or they produce two plans fighting over one filename.
 */
function planIdFor(name) {
    return slugify(bareName(name).replace(/-/g, ' '));
}

// ── Blog -> destination ──────────────────────────────────────────────────────

/**
 * Resolve a blog to a destination by scanning its title, longest name first so
 * "Northeast India" wins over "India". Verified to agree with the generator's
 * own DESTS[i % len] assignment on all 1000 generated posts, and unlike that
 * assignment it does not depend on index.json ordering.
 */
function makeResolver(destinations) {
    const ordered = [...destinations].sort((a, b) => bareName(b.name).length - bareName(a.name).length);
    const patterns = ordered.map(d => ({
        dest: d,
        re: new RegExp(`\\b${bareName(d.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }));
    return function resolve(title) {
        for (const p of patterns) if (p.re.test(title)) return p.dest;
        return null;
    };
}

// ── Places: curated (must-visits) ────────────────────────────────────────────

function loadMustVisitIndex() {
    const file = path.join(MV_DIR, 'index.json');
    if (!fs.existsSync(file)) return new Map();
    const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const map = new Map();
    for (const d of list) {
        map.set(d.slug, d);
        map.set(slugify(d.name), d);
    }
    return map;
}

/** Best-effort match from a blog destination name to a must-visits slug. */
function mustVisitSlugFor(destName, mvIndex) {
    const alias = MUST_VISIT_ALIASES[destName];
    if (alias && mvIndex.has(alias)) return alias;
    const direct = slugify(bareName(destName));
    if (mvIndex.has(direct)) return direct;
    return null;
}

/** Parse "Half day to full day" / "2-3 hours" into minutes. */
function durationToMinutes(text) {
    if (!text) return 90;
    const t = text.toLowerCase();
    if (t.includes('full day')) return 360;
    if (t.includes('half day')) return 240;
    const hours = t.match(/(\d+)(?:\s*[-–to]+\s*(\d+))?\s*hour/);
    if (hours) {
        const lo = Number(hours[1]);
        const hi = hours[2] ? Number(hours[2]) : lo;
        return Math.round(((lo + hi) / 2) * 60);
    }
    const mins = t.match(/(\d+)\s*min/);
    if (mins) return Number(mins[1]);
    return 90;
}

function placesFromMustVisits(slug, limit = 10) {
    const file = path.join(MV_DIR, `${slug}.json`);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const attractions = (data.attractions || []).slice(0, limit);
    if (attractions.length === 0) return null;
    return attractions.map(a => ({
        name: a.name,
        description: a.whyVisit || a.description || '',
        category: a.category || 'place',
        estimatedMinutes: durationToMinutes(a.duration),
        mapsSearch: a.mapsSearch || `${a.name}, ${data.name}`,
        bestTime: a.bestTime || null,
        // Curated photos are of the actual place, so they are safe to show.
        imageUrl: a.coverImage || null,
    }));
}

// ── Places: OpenAI ───────────────────────────────────────────────────────────

async function placesFromAi(destName, country) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            max_tokens: 1400,
            messages: [
                {
                    role: 'system',
                    content: 'You are a travel expert. Given a destination, list the specific places a first-time visitor should see. Every entry must be a concrete, visitable spot — never the city or country itself. Return only valid JSON.',
                },
                {
                    role: 'user',
                    content: `Destination: "${destName}"${country && country !== destName ? ` (${country})` : ''}.
Return JSON:
{"suggestedDays": 5, "places": [{"name": "Actual attraction name", "description": "One sentence on what it is and why it is worth the time", "category": "beach|temple|museum|viewpoint|market|heritage|nature|wildlife|food|city", "estimatedMinutes": 120, "mapsSearch": "Name, City, Country"}]}
Give 8-10 varied places covering the destination's main regions, and a realistic suggestedDays for seeing them without rushing.`,
                },
            ],
        }),
    });

    if (!res.ok) {
        throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = await res.json();
    const parsed = JSON.parse(json.choices[0].message.content);
    const places = (parsed.places || []).map(p => ({
        name: p.name,
        description: p.description || '',
        category: p.category || 'place',
        estimatedMinutes: Number(p.estimatedMinutes) || 120,
        mapsSearch: p.mapsSearch || `${p.name}, ${destName}`,
        bestTime: null,
        // No photo: a stock shot of the region would be a picture of somewhere
        // else. PlaceThumb resolves a real Google photo at runtime instead.
        imageUrl: null,
    })).filter(p => p.name);
    return { places, suggestedDays: Number(parsed.suggestedDays) || 5 };
}

// ── Cache ────────────────────────────────────────────────────────────────────

function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) return { destinations: {} };
    try {
        const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        return c.destinations ? c : { destinations: {} };
    } catch {
        return { destinations: {} };
    }
}

function isFresh(entry) {
    if (FORCE || !entry || !entry.fetchedAt) return false;
    const ageDays = (Date.now() - new Date(entry.fetchedAt).getTime()) / 86400000;
    return ageDays < TTL_DAYS;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Plan assembly ────────────────────────────────────────────────────────────

function suggestedDaysFor(placeCount, fallback) {
    if (fallback) return fallback;
    // Roughly two or three stops a day, floor of 3, ceiling of 10.
    return Math.min(10, Math.max(3, Math.ceil(placeCount / 2.5)));
}

async function buildDestinationPlan(id, dest, mvIndex, cache, stats) {
    const mvSlug = mustVisitSlugFor(dest.name, mvIndex);

    let places = null;
    let source = null;
    let aiDays = null;

    if (mvSlug) {
        places = placesFromMustVisits(mvSlug);
        if (places) {
            source = 'must-visits';
            stats.curated++;
        }
    }

    if (!places) {
        const cached = cache.destinations[id];
        if (isFresh(cached)) {
            places = cached.places;
            aiDays = cached.suggestedDays;
            source = 'ai-cached';
            stats.cached++;
        } else if (!NO_AI && API_KEY) {
            try {
                const r = await placesFromAi(dest.name, dest.country);
                if (r.places.length) {
                    places = r.places;
                    aiDays = r.suggestedDays;
                    source = 'ai';
                    cache.destinations[id] = {
                        places: r.places,
                        suggestedDays: r.suggestedDays,
                        fetchedAt: new Date().toISOString(),
                    };
                    stats.fetched++;
                    await sleep(120); // stay well inside rate limits
                }
            } catch (err) {
                stats.failed.push(`${dest.name}: ${err.message}`);
                // Fall back to a stale cache entry rather than dropping the plan.
                if (cached?.places?.length) {
                    places = cached.places;
                    aiDays = cached.suggestedDays;
                    source = 'ai-stale';
                    stats.stale++;
                }
            }
        } else {
            stats.skipped++;
        }
    }

    if (!places || places.length === 0) return null;

    const days = suggestedDaysFor(places.length, aiDays);
    return {
        id,
        kind: 'destination',
        title: dest.name,
        destination: dest.name,
        country: dest.country,
        tags: dest.tags,
        suggestedDays: days,
        places,
        estimate: buildEstimate(dest.country, days),
        source,
        generatedAt: new Date().toISOString(),
    };
}

function buildCollectionPlan(blogId, spec, planById) {
    const options = [];
    const seen = new Set();
    for (const destName of spec.destinations) {
        const plan = planById.get(planIdFor(destName));
        if (!plan || seen.has(plan.id)) continue;
        seen.add(plan.id);
        options.push({
            id: plan.id,
            title: plan.title,
            country: plan.country,
            suggestedDays: plan.suggestedDays,
            placeCount: plan.places.length,
            estimate: plan.estimate,
            // A preview so the chooser can show something before the reader
            // picks; the full list lives in the destination plan.
            previewPlaces: plan.places.slice(0, 4).map(p => p.name),
        });
    }
    if (options.length === 0) return null;
    return {
        id: `collection-${blogId}`,
        kind: 'collection',
        title: spec.title,
        blurb: spec.blurb,
        options,
        generatedAt: new Date().toISOString(),
    };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    fs.mkdirSync(PLANS_DIR, { recursive: true });

    const destinations = loadDestinations();
    const resolve = makeResolver(destinations);
    const mvIndex = loadMustVisitIndex();
    const cache = loadCache();

    const blogIndex = JSON.parse(fs.readFileSync(path.join(BLOG_DIR, 'index.json'), 'utf-8'));

    console.log(`Destinations: ${destinations.length} · must-visits: ${mvIndex.size / 2 | 0} · blogs: ${blogIndex.length}`);
    if (!API_KEY && !NO_AI) {
        console.log('! OPENAI_API_KEY not set — curated (must-visits) plans only.');
        console.log('  Set it and re-run to fill in the remaining destinations.');
    }

    // Which destinations does any blog actually point at? No sense paying for
    // places nobody links to.
    const needed = new Map();          // planId -> destination
    const blogToPlanId = new Map();    // blogId -> planId
    for (const entry of blogIndex) {
        if (NO_PLAN.has(entry.id) || COLLECTIONS[entry.id]) continue;
        const dest = resolve(entry.title);
        if (!dest) continue;
        blogToPlanId.set(entry.id, planIdFor(dest.name));
        needed.set(planIdFor(dest.name), dest);
    }
    for (const spec of Object.values(COLLECTIONS)) {
        for (const name of spec.destinations) {
            const id = planIdFor(name);
            if (needed.has(id)) continue;
            const dest = destinations.find(d => planIdFor(d.name) === id);
            if (dest) needed.set(id, dest);
            else if (mvIndex.has(slugify(name))) {
                // A curated destination the blog list doesn't carry (Coorg,
                // Majuli). Country is India by construction — must-visits is
                // India-only.
                needed.set(id, { name, country: 'India', tags: [name, 'India'] });
            }
        }
    }
    console.log(`Destinations referenced by blogs: ${needed.size}`);

    // ── Destination plans ──
    const stats = { curated: 0, cached: 0, fetched: 0, stale: 0, skipped: 0, failed: [] };
    const planById = new Map();
    let n = 0;
    for (const [planId, dest] of needed) {
        n++;
        const plan = await buildDestinationPlan(planId, dest, mvIndex, cache, stats);
        if (plan) planById.set(planId, plan);
        if (n % 25 === 0) process.stdout.write(`  ...${n}/${needed.size}\n`);
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

    // ── Collection plans ──
    const collectionPlans = [];
    for (const [blogId, spec] of Object.entries(COLLECTIONS)) {
        const plan = buildCollectionPlan(blogId, spec, planById);
        if (plan) collectionPlans.push([blogId, plan]);
    }

    // ── Write plan files ──
    const allPlans = [...planById.values(), ...collectionPlans.map(([, p]) => p)];
    const existing = new Set(fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.json')));
    for (const plan of allPlans) {
        fs.writeFileSync(path.join(PLANS_DIR, `${plan.id}.json`), JSON.stringify(plan));
        existing.delete(`${plan.id}.json`);
    }
    // Drop plans for destinations no blog references any more.
    for (const orphan of existing) fs.unlinkSync(path.join(PLANS_DIR, orphan));

    // ── blogId -> planId ──
    const byBlog = {};
    for (const entry of blogIndex) {
        const collection = collectionPlans.find(([id]) => id === entry.id);
        if (collection) { byBlog[entry.id] = collection[1].id; continue; }
        const planId = blogToPlanId.get(entry.id);
        if (planId && planById.has(planId)) byBlog[entry.id] = planId;
    }

    // Stamp planId onto each blog's content file so the blog page can show the
    // buttons without a second request. Idempotent: re-running just rewrites it.
    let stamped = 0;
    let cleared = 0;
    for (const entry of blogIndex) {
        const file = path.join(BLOG_CONTENT, `${entry.id}.json`);
        if (!fs.existsSync(file)) continue;
        const post = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const planId = byBlog[entry.id] || null;
        if (post.planId === planId) continue;
        if (planId) { post.planId = planId; stamped++; }
        else if ('planId' in post) { delete post.planId; cleared++; }
        else continue;
        fs.writeFileSync(file, JSON.stringify(post, null, 2));
    }

    const manifest = {
        generatedAt: new Date().toISOString(),
        planCount: allPlans.length,
        destinationPlans: planById.size,
        collectionPlans: collectionPlans.length,
        blogsWithPlans: Object.keys(byBlog).length,
        blogsTotal: blogIndex.length,
        ttlDays: TTL_DAYS,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'by-blog.json'), JSON.stringify(byBlog));

    // ── Optionally mirror into dist/ so a running server picks it up without
    //    a rebuild (see the cron notes in the header). ──
    if (WRITE_DIST) {
        if (fs.existsSync(path.join(ROOT, 'dist'))) {
            fs.rmSync(DIST_DIR, { recursive: true, force: true });
            fs.cpSync(OUT_DIR, DIST_DIR, { recursive: true });
            fs.cpSync(BLOG_CONTENT, path.join(ROOT, 'dist', 'blogs', 'content'), { recursive: true });
            console.log('→ mirrored into dist/');
        } else {
            console.log('! --dist given but no dist/ directory; skipped');
        }
    }

    console.log('\n' + '─'.repeat(58));
    console.log(`Plans written        ${allPlans.length}  (${planById.size} destination, ${collectionPlans.length} collection)`);
    console.log(`Places from curated  ${stats.curated}`);
    console.log(`Places from AI       ${stats.fetched} fetched, ${stats.cached} cached, ${stats.stale} stale-fallback`);
    if (stats.skipped) console.log(`Skipped (no API key) ${stats.skipped}`);
    console.log(`Blogs with a plan    ${manifest.blogsWithPlans}/${manifest.blogsTotal}`);
    console.log(`planId stamped       ${stamped} added/changed, ${cleared} cleared`);
    if (stats.failed.length) {
        console.log(`\nFailures (${stats.failed.length}):`);
        for (const f of stats.failed.slice(0, 10)) console.log('  ' + f);
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
