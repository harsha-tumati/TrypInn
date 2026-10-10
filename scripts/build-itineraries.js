#!/usr/bin/env bun
/**
 * Build the "Suggested itinerary" cards for travel guides that describe a trip.
 *
 * Sources, in order of precedence:
 *   1. scripts/itineraries/data.js — hand-written from each article. Always wins.
 *   2. GPT extraction (--gpt) — for other trip-shaped posts. gpt-4o-mini reads
 *      the article and returns the route it describes. Any stop the article
 *      doesn't actually name is thrown away, so the model can tidy a route but
 *      can't invent one. Results are cached by content hash.
 *
 * Every stop is then resolved through Google Places Text Search (New) so the
 * planner opens with each location already pinned. The itinerary page drops
 * places that have no coordinates, so this step is what makes "view this trip
 * completely" actually complete.
 *
 * Caching follows Google Maps Platform terms: place IDs may be kept
 * indefinitely, coordinates for at most 30 days. Coordinates here expire after
 * PLACES_TTL_DAYS (default 25) and are re-fetched; run weekly via
 * scripts/refresh-trip-plans.sh.
 *
 * Output: each qualifying blog's content JSON gains an `itinerary` field, so
 * the card renders with the article — no extra request, no layout shift.
 * public/itineraries/index.json lists what was built.
 *
 * Usage:
 *   bun run scripts/build-itineraries.js            # hand-written + cached
 *   bun run scripts/build-itineraries.js --gpt      # also ask GPT
 *   bun run scripts/build-itineraries.js --dist     # mirror into dist/
 *
 * Env (Bun loads .env automatically):
 *   GOOGLE_MAPS_SERVER_KEY   preferred: a key WITHOUT website restrictions,
 *                            since this runs on a server, not in a browser
 *   VITE_GOOGLE_MAPS_API_KEY fallback
 *   OPENAI_API_KEY / VITE_OPENAI_API_KEY   for --gpt
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { ITINERARIES } from './itineraries/data.js';
import { buildEstimate, buildBlendedEstimate } from './trip-plans/cost-model.js';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'public', 'blogs');
const CONTENT = path.join(BLOG_DIR, 'content');
const OUT_DIR = path.join(ROOT, 'public', 'itineraries');
const PLACES_CACHE = path.join(ROOT, 'scripts', '.itinerary-places-cache.json');
const GPT_CACHE = path.join(ROOT, 'scripts', '.itinerary-gpt-cache.json');

const args = new Set(process.argv.slice(2));
const USE_GPT = args.has('--gpt');
const WRITE_DIST = args.has('--dist');
const TTL_DAYS = Number(process.env.PLACES_TTL_DAYS || 25);
const MAPS_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return fallback; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Day labels ───────────────────────────────────────────────────────────────

/** '1–2' → { from: 1, to: 2 }, '3' → { from: 3, to: 3 }. */
function parseDays(label) {
    if (!label) return null;
    const m = String(label).match(/^(\d+)(?:\s*[–-]\s*(\d+))?$/);
    if (!m) return null;
    return { from: Number(m[1]), to: Number(m[2] || m[1]) };
}

function totalDays(option) {
    if (option.days) return option.days;
    const ends = option.legs.map(l => parseDays(l.days)?.to).filter(Boolean);
    return ends.length ? Math.max(...ends) : null;
}

// ── Article helpers ──────────────────────────────────────────────────────────

/** Fold accents and case so "Gjirokastër" in the data matches the article. */
function fold(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function headings(content) {
    return [...content.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
}

function hasAnchor(content, anchor) {
    return headings(content).some(h => fold(h).startsWith(fold(anchor)));
}

/** Cheap pre-filter for --gpt: only send posts that look like a route. */
function looksLikeTrip(content) {
    const dayMarkers = (content.match(/\bDays? \d+(?:\s*[–-]\s*\d+)?\b/g) || []).length;
    const routeHeading = /^## .*(route|itinerary|\bdays?\b)/im.test(content);
    return dayMarkers >= 3 || routeHeading;
}

// ── GPT extraction ───────────────────────────────────────────────────────────

let gptDisabled = false;

async function extractWithGpt(post) {
    const body = post.content.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0,
            response_format: { type: 'json_object' },
            max_tokens: 2500,
            messages: [
                {
                    role: 'system',
                    content: [
                        'You extract travel itineraries from articles.',
                        'Only extract a trip the article actually lays out: an ordered route through named places, ideally with day counts.',
                        'Articles that list destinations, give advice, or describe a single place without a route do NOT describe a trip.',
                        'Use place names exactly as the article writes them. Never add a place the article does not name.',
                        'Return only valid JSON.',
                    ].join(' '),
                },
                {
                    role: 'user',
                    content: `Article title: ${post.title}

Return JSON in this shape:
{"describesTrip": true|false,
 "anchor": "the exact text of the ## heading whose section lays out the route",
 "options": [{"title": "short name", "country": "main country",
   "legs": [{"days": "1–2" or null, "base": "where you are", "country": "country", "travel": false,
     "note": "an alternative the article offers, or null",
     "stops": [{"name": "place name as written", "q": "Place name, City, Country", "cat": "beach|temple|museum|viewpoint|market|heritage|nature|wildlife|food|park|garden|place", "min": 90}]}]}]}

If the article does not describe a trip, return {"describesTrip": false}.

Article:
${body}`,
                },
            ],
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 401 || res.status === 403) gptDisabled = true;
        throw new Error(`OpenAI ${res.status}: ${text.slice(0, 160)}`);
    }
    const json = await res.json();
    return JSON.parse(json.choices[0].message.content);
}

/**
 * Keep only what the article supports. A stop survives if its name appears in
 * the article; a leg survives if it still has stops or is a transit day.
 */
function validateGpt(result, content) {
    if (!result?.describesTrip || !Array.isArray(result.options)) return null;
    if (!result.anchor || !hasAnchor(content, result.anchor)) return null;
    const text = fold(content);
    let dropped = 0;
    const options = result.options.map((o, i) => {
        const legs = (o.legs || []).map(l => {
            const stops = (l.stops || []).filter(s => {
                const ok = s?.name && s?.q && text.includes(fold(s.name));
                if (!ok) dropped++;
                return ok;
            }).map(s => ({ name: s.name, q: s.q, cat: s.cat || 'place', min: Number(s.min) || 90 }));
            return { days: l.days || undefined, base: l.base, country: l.country, travel: !!l.travel, note: l.note || undefined, stops };
        }).filter(l => l.base && (l.travel || l.stops.length));
        return { id: `gpt-${i + 1}`, title: o.title || 'Suggested route', country: o.country, legs };
    }).filter(o => o.country && o.legs.some(l => l.stops.length));
    if (!options.length) return null;
    return { anchor: result.anchor, options, dropped };
}

// ── Places ───────────────────────────────────────────────────────────────────

let placesCalls = 0;

async function resolvePlace(stop, cache) {
    const { q, within } = stop;
    const key = within ? `${q} @${within.join(',')}` : q;
    const hit = cache[key];
    const fresh = hit?.fetchedAt && (Date.now() - new Date(hit.fetchedAt).getTime()) / 86400000 < TTL_DAYS;
    if (fresh) return hit;
    if (!MAPS_KEY) return hit ? { placeId: hit.placeId } : null;

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': MAPS_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify({
            textQuery: q,
            maxResultCount: 1,
            ...(within && { locationRestriction: { rectangle: {
                low: { latitude: within[0], longitude: within[1] },
                high: { latitude: within[2], longitude: within[3] },
            } } }),
        }),
    });
    placesCalls++;
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Places ${res.status}: ${text.slice(0, 200)}`);
    }
    const p = (await res.json()).places?.[0];
    if (!p) return null;
    const entry = {
        placeId: p.id,
        address: p.formattedAddress || '',
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        fetchedAt: new Date().toISOString(),
    };
    cache[key] = entry;
    await sleep(60);
    return entry;
}

/**
 * The resolved address should mention the query's country or its region.
 * Google writes Indian addresses as state + PIN with no "India", so checking
 * the country alone raised false alarms on correct results.
 */
function countryMismatch(q, address) {
    const parts = q.split(',').map(p => p.trim()).filter(Boolean);
    if (!address || parts.length < 2) return false;
    const a = fold(address);
    return !parts.slice(1).some(p => a.includes(fold(p)));
}

// ── Build ────────────────────────────────────────────────────────────────────

async function buildOption(option, cache, warnings, blogId) {
    const legs = [];
    for (const leg of option.legs) {
        const stops = [];
        for (const s of leg.stops) {
            let place = null;
            try {
                place = await resolvePlace(s, cache);
            } catch (err) {
                warnings.push(`${blogId}: ${s.name} — ${err.message}`);
                if (/API_KEY|PERMISSION|403|401/.test(err.message)) throw err;
            }
            if (!place) warnings.push(`${blogId}: no Places match for "${s.q}"`);
            else if (countryMismatch(s.q, place.address)) warnings.push(`${blogId}: "${s.name}" resolved to "${place.address}" — check it`);
            stops.push({
                name: s.name,
                cat: s.cat || 'place',
                min: s.min || 90,
                placeId: place?.placeId || null,
                lat: place?.lat ?? null,
                lng: place?.lng ?? null,
                address: place?.address || '',
            });
        }
        legs.push({
            days: leg.days || null,
            base: leg.base,
            country: leg.country || option.country,
            travel: !!leg.travel,
            note: leg.note || null,
            stops,
        });
    }

    const days = totalDays(option);
    // Without day labels (Kashmir, Sikkim) there is no stated length; the
    // estimate panel opens on a rough default the reader can change.
    const stopCount = legs.reduce((n, l) => n + l.stops.length, 0);
    const estimateDays = days || Math.min(10, Math.max(4, Math.ceil(stopCount / 2.5)));

    const spans = [];
    for (const leg of legs) {
        const d = parseDays(leg.days);
        const n = d ? d.to - d.from + 1 : 0;
        const last = spans[spans.length - 1];
        if (last && last.country === leg.country) last.days += n;
        else spans.push({ country: leg.country, days: n });
    }
    const multiCountry = new Set(legs.map(l => l.country)).size > 1;
    const estimate = multiCountry
        ? buildBlendedEstimate(spans, estimateDays)
        : buildEstimate(option.country, estimateDays);

    const located = legs.flatMap(l => l.stops).filter(s => s.lat != null);
    return {
        id: option.id,
        title: option.title,
        country: option.country,
        countries: [...new Set(legs.map(l => l.country))],
        days,
        note: option.note || null,
        estimate,
        legs,
        stopCount,
        locatedCount: located.length,
    };
}

async function main() {
    if (!MAPS_KEY) console.log('! No Maps key — stops will be saved without coordinates and geocoded on click instead.');

    const index = readJson(path.join(BLOG_DIR, 'index.json'), []);
    const placesCache = readJson(PLACES_CACHE, {});
    const gptCache = readJson(GPT_CACHE, {});
    const warnings = [];
    const built = {};
    const sources = {};

    // 1. Hand-written itineraries.
    for (const [blogId, spec] of Object.entries(ITINERARIES)) {
        const file = path.join(CONTENT, `${blogId}.json`);
        if (!fs.existsSync(file)) { warnings.push(`${blogId}: no content file — skipped`); continue; }
        const post = readJson(file);
        if (!hasAnchor(post.content, spec.anchor)) {
            warnings.push(`${blogId}: anchor "${spec.anchor}" not found — card will sit after the article`);
        }
        built[blogId] = { anchor: spec.anchor, options: spec.options };
        sources[blogId] = 'hand-written';
    }

    // 2. GPT for other trip-shaped posts.
    if (USE_GPT) {
        if (!OPENAI_KEY) {
            console.log('! --gpt given but no OpenAI key; skipping extraction.');
        } else {
            const candidates = index.filter(e => !ITINERARIES[e.id]).filter(e => {
                const post = readJson(path.join(CONTENT, `${e.id}.json`));
                return post?.content && looksLikeTrip(post.content);
            });
            console.log(`GPT: ${candidates.length} trip-shaped posts without a hand-written itinerary`);
            for (const e of candidates) {
                if (gptDisabled) break;
                const post = readJson(path.join(CONTENT, `${e.id}.json`));
                const hash = crypto.createHash('sha1').update(post.content).digest('hex');
                let result = gptCache[e.id]?.hash === hash ? gptCache[e.id].result : undefined;
                if (result === undefined) {
                    try {
                        result = await extractWithGpt(post);
                        gptCache[e.id] = { hash, result, at: new Date().toISOString() };
                    } catch (err) {
                        warnings.push(`GPT ${e.id}: ${err.message}`);
                        if (gptDisabled) console.log('! OpenAI rejected the key; GPT extraction stopped for this run.');
                        continue;
                    }
                }
                const valid = validateGpt(result, post.content);
                if (!valid) continue;
                if (valid.dropped) warnings.push(`GPT ${e.id}: dropped ${valid.dropped} stop(s) the article doesn't name`);
                built[e.id] = { anchor: valid.anchor, options: valid.options };
                sources[e.id] = 'gpt';
            }
            fs.writeFileSync(GPT_CACHE, JSON.stringify(gptCache, null, 2));
        }
    }

    // 3. Resolve places and assemble.
    const output = {};
    try {
        for (const [blogId, spec] of Object.entries(built)) {
            const options = [];
            for (const o of spec.options) options.push(await buildOption(o, placesCache, warnings, blogId));
            output[blogId] = { anchor: spec.anchor, source: sources[blogId], options, generatedAt: new Date().toISOString() };
        }
    } finally {
        fs.writeFileSync(PLACES_CACHE, JSON.stringify(placesCache, null, 2));
    }

    // 4. Stamp into blog content (idempotent; removes stale cards too).
    let stamped = 0, cleared = 0;
    for (const e of index) {
        const file = path.join(CONTENT, `${e.id}.json`);
        if (!fs.existsSync(file)) continue;
        const post = readJson(file);
        const next = output[e.id];
        if (next) { post.itinerary = next; stamped++; }
        else if ('itinerary' in post) { delete post.itinerary; cleared++; }
        else continue;
        fs.writeFileSync(file, JSON.stringify(post, null, 2));
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const manifest = {
        generatedAt: new Date().toISOString(),
        blogs: Object.entries(output).map(([id, it]) => ({
            id,
            source: it.source,
            options: it.options.map(o => ({ id: o.id, title: o.title, days: o.days, stops: o.stopCount, located: o.locatedCount })),
        })),
    };
    fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(manifest, null, 2));

    if (WRITE_DIST && fs.existsSync(path.join(ROOT, 'dist'))) {
        fs.cpSync(CONTENT, path.join(ROOT, 'dist', 'blogs', 'content'), { recursive: true });
        fs.cpSync(OUT_DIR, path.join(ROOT, 'dist', 'itineraries'), { recursive: true });
        console.log('→ mirrored into dist/');
    }

    const opts = Object.values(output).flatMap(o => o.options);
    const stops = opts.reduce((n, o) => n + o.stopCount, 0);
    const located = opts.reduce((n, o) => n + o.locatedCount, 0);
    console.log('─'.repeat(56));
    console.log(`Blogs with an itinerary  ${Object.keys(output).length}  (${Object.values(sources).filter(s => s === 'gpt').length} from GPT)`);
    console.log(`Routes                   ${opts.length}`);
    console.log(`Stops located            ${located}/${stops}`);
    console.log(`Places API calls         ${placesCalls}`);
    console.log(`Content files            ${stamped} stamped, ${cleared} cleared`);
    if (warnings.length) {
        console.log(`\nWarnings (${warnings.length}):`);
        for (const w of warnings) console.log('  ' + w);
    }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
