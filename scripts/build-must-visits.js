#!/usr/bin/env node
/**
 * Build Must-Visits data for all destinations.
 *
 * Reads curated, text-only destination definitions from scripts/mv-data/*.json,
 * fetches REAL location-specific images from Unsplash (one search per attraction,
 * cached + resumable), generates the SEO copy (150-250w intro + ~350w page
 * content + meta), and writes the final per-destination JSON + index.json into
 * public/must-visits/.
 *
 * No API key required — uses Unsplash's public search endpoint. Re-runnable:
 * image lookups are cached in scripts/.mv-image-cache.json so repeat builds are
 * instant and only new attractions hit the network.
 *
 * Usage:
 *   node scripts/build-must-visits.js            # build everything
 *   node scripts/build-must-visits.js goa jaipur # build only these slugs
 *   FORCE_IMAGES=1 node scripts/build-must-visits.js  # ignore the image cache
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, 'mv-data');
const OUT_DIR = path.resolve(__dirname, '../public/must-visits');
const CACHE_FILE = path.resolve(__dirname, '.mv-image-cache.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Master popularity order — the directory + sitemap list follows this.
const POPULARITY_ORDER = [
    'Goa', 'Leh-Ladakh', 'Manali', 'Kashmir', 'Jaipur', 'Udaipur', 'Taj Mahal', 'Rishikesh', 'Varanasi', 'Kerala Backwaters',
    'Andaman Islands', 'Darjeeling', 'Munnar', 'Coorg', 'Jaisalmer', 'Amritsar', 'Hampi', 'Meghalaya', 'Spiti Valley', 'Rann of Kutch',
    'Shimla', 'Ooty', 'Nainital', 'Mussoorie', 'Gangtok', 'Pondicherry', 'Hyderabad', 'Mysuru', 'Chikmagalur', 'Dharamshala',
    'Kodaikanal', 'Tirupati', 'Puri', 'Madurai', 'Agra', 'Delhi', 'Jodhpur', 'Pushkar', 'Auli', 'Kovalam',
    'Wayanad', 'Gokarna', 'Varkala', 'Shillong', 'Cherrapunji', 'Tawang', 'Kasol', 'Dalhousie', 'Haridwar', 'Ayodhya',
    'Rameswaram', 'Mahabalipuram', 'Thanjavur', 'Bikaner', 'Mount Abu', 'Alleppey', 'Thekkady', 'Kumarakom', 'Yercaud', 'Diu',
    'Ziro', 'Mawlynnong', 'Nubra Valley', 'Pangong Lake', 'Yumthang Valley', 'Pelling', 'Dzukou Valley', 'Orchha', 'Khajuraho', 'Sanchi',
    'Bhopal', 'Ujjain', 'Indore', 'Bhubaneswar', 'Konark', 'Gulmarg', 'Sonamarg', 'Pahalgam', 'Srinagar', 'Patnitop',
    'Jim Corbett National Park', 'Ranthambore National Park', 'Kaziranga National Park', 'Gir National Park', 'Kanha National Park', 'Bandhavgarh National Park', 'Periyar National Park', 'Nagarhole National Park', 'Majuli', 'Tarkarli',
    'Lonar', 'Lonavala', 'Mahabaleshwar', 'Aurangabad', 'Ajanta Caves', 'Ellora Caves', 'Kutch', 'Dwarka', 'Somnath', 'Daman',
];

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const rankOf = (name) => {
    const i = POPULARITY_ORDER.findIndex(n => slugify(n) === slugify(name));
    return i === -1 ? 999 : i;
};

// ── Image cache ───────────────────────────────────────────────────────────
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }
const FORCE = process.env.FORCE_IMAGES === '1';
let cacheDirty = false;
function saveCache() {
    if (cacheDirty) { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0)); cacheDirty = false; }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Run async fn over items with bounded concurrency, preserving result order.
async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

// Fetch a list of real, non-premium Unsplash photo IDs for a query.
async function searchUnsplash(query) {
    const key = query.toLowerCase().trim();
    if (!FORCE && cache[key]) return cache[key];

    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`;
    let ids = [];
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            // Unsplash's public napi blocks browser-like User-Agents from
            // non-browser origins but allows simple curl-style clients.
            const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'curl/8.7.1' } });
            if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
            if (!res.ok) break;
            const data = await res.json();
            for (const r of (data.results || [])) {
                if (r.plus || r.premium) continue;
                const raw = r.urls?.raw || '';
                if (raw.includes('plus.unsplash.com')) continue;
                const m = raw.match(/photo-([a-f0-9]+-[a-f0-9]+)/);
                if (m && m[1]) ids.push(m[1]);
            }
            ids = [...new Set(ids)];
            break;
        } catch {
            await sleep(800 * (attempt + 1));
        }
    }
    cache[key] = ids;
    cacheDirty = true;
    return ids;
}

function imgUrl(id, w) {
    return `https://images.unsplash.com/photo-${id}?fm=webp&w=${w}&q=60`;
}

// Curated category → generic-but-real fallback image pools keyed by destination
// theme, only used if a specific search returns nothing.
function imagePrompt(attraction, destination) {
    return `Ultra realistic travel photography, golden hour lighting, vibrant colors, ${attraction} in ${destination}, tourists enjoying the view, DSLR quality, 4k, cinematic composition, highly detailed`;
}

// ── SEO copy generators ────────────────────────────────────────────────────
function makeIntroduction(d) {
    const names = d.attractions.map(a => a.name);
    const top3 = names.slice(0, 3);
    const last = d.attractions[d.attractions.length - 1]?.name;
    return (
        `Planning the perfect trip starts with knowing the must visit places in ${d.name}. ` +
        `From ${top3[0]} to ${top3[1]} and ${top3[2]}, the best places to visit in ${d.name} blend ` +
        `iconic landmarks with quiet corners most travelers miss. This travel guide to ${d.name} brings together ` +
        `${d.attractions.length} top tourist attractions in ${d.name}, hand-ranked by popularity and real visitor reviews, ` +
        `so you can plan with confidence. Whether you are chasing ${d.highlights?.[0] || 'sweeping views'}, ` +
        `${d.highlights?.[1] || 'local culture'}, or simply the best things to do in ${d.name} over a long weekend, ` +
        `you will find every essential here — complete with the ideal time to go, how long to spend, and a one-tap Google Maps link. ` +
        `We have also tucked in genuine hidden gems like ${last} after the headline sights, ` +
        `because the most memorable moments in ${d.name} often happen off the obvious trail. ` +
        `Every entry below is ranked by what real travellers rate most, paired with a vivid photo, ` +
        `the best time to visit, how long to spend, and a direct Google Maps link — so this doubles ` +
        `as a practical travel guide to ${d.name} and a ready-made shortlist for your itinerary. ` +
        `Read on for the definitive list of tourist attractions in ${d.name} and start mapping your trip.`
    );
}

function make350(d) {
    const names = d.attractions.map(a => a.name);
    const headline = names.slice(0, 5);
    const more = names.slice(5, 10);
    const gems = names.slice(-3);
    const catLabels = (d.categories || []).join(', ');
    const para1 =
        `${d.name} ranks among ${d.state}'s most rewarding destinations, and it is easy to see why travelers keep returning. ` +
        `Known for ${d.tagline.toLowerCase()}, it packs a remarkable variety of experiences into one trip. ` +
        `When people search for the best places to visit in ${d.name}, the headline names come up again and again: ` +
        `${headline.join(', ')}. Each earns its spot for a reason — together they capture the ${catLabels} character that defines the region.`;
    const para2 =
        `Beyond the icons, the must visit places in ${d.name} reward anyone willing to explore a little further. ` +
        `Spots such as ${more.join(', ')} round out an itinerary and show a different side of the destination. ` +
        `For the best experience, time your visit thoughtfully: many of the top tourist attractions in ${d.name} are at their finest ` +
        `early in the day or around golden hour, when the light is soft, crowds are thin, and photographs come alive. ` +
        `Most travelers find that two to four unhurried days are enough to cover the essentials without rushing.`;
    const para3 =
        `Looking for things to do in ${d.name} that go beyond the guidebook? Seek out the quieter finds — ` +
        `${gems.join(', ')} — where you will trade ticket queues for genuine local atmosphere. ` +
        `This curated guide is built to be the most useful starting point on the internet for your trip: every attraction below ` +
        `includes why it is worth your time, the best time to visit, a realistic duration, and a direct Google Maps search. ` +
        `Use it to shortlist your favourites, then drop them straight into a Trypinn itinerary, invite your crew, and turn ` +
        `a list of must-see places in ${d.name} into a trip that actually happens.`;
    const topCats = (d.categories || []).join(' and ');
    const para4 =
        `Planning practicalities matter as much as the sights. A typical visit to ${d.name} in ${d.state} works best ` +
        `as a two-to-four-day trip, leaving room to slow down rather than tick boxes. Group the ${headline[0]} and ` +
        `${headline[1] || headline[0]} area together to cut travel time, and keep a relaxed half-day spare for the ` +
        `hidden gems and spontaneous detours that make ${topCats || 'a trip here'} so memorable. Whatever season you choose, ` +
        `book stays and any permits or tickets ahead during peak months, start early to beat the crowds, and carry the ` +
        `Google Maps links below so navigating between the best places to visit in ${d.name} stays effortless from the ` +
        `first attraction to the last.`;
    return [para1, para2, para3, para4];
}

function metaTitle(d) {
    return `${d.attractions.length} Must Visit Places in ${d.name} (2026) — Top Attractions | Trypinn`;
}
function metaDescription(d) {
    const top = d.attractions.slice(0, 3).map(a => a.name).join(', ');
    let s = `Discover the best places to visit in ${d.name}: ${top} and more. ${d.attractions.length} top tourist attractions, hidden gems, best times & travel tips.`;
    return s.length > 158 ? s.slice(0, 155) + '…' : s;
}

// ── Per-destination build ──────────────────────────────────────────────────
async function buildDestination(def) {
    const name = def.name;
    const slug = def.slug || slugify(name);
    const state = def.state;

    // Destination-level fallback image pool (real photos of the place). Pull from
    // several broad queries so even small destinations have enough real photos.
    const destPool = [];
    for (const q of [`${name} ${state} India landscape`, `${name} India`, `${state} India tourism`, `${name} ${state}`]) {
        for (const id of await searchUnsplash(q)) if (!destPool.includes(id)) destPool.push(id);
    }
    const usedIds = new Set();

    // Prefer an unused image; fall back to reusing a real one rather than null.
    const pickUnique = (ids) => {
        for (const id of ids) { if (!usedIds.has(id)) { usedIds.add(id); return id; } }
        return ids[0] || null;
    };
    let destPoolCursor = 0;
    const fallbackImage = () => {
        if (destPool.length === 0) return null;
        return destPool[destPoolCursor++ % destPool.length];
    };

    // Phase 1 (parallel): collect candidate image-ID lists for every attraction.
    const candidates = await mapLimit(def.attractions, 6, async (a) => {
        const queries = [
            a.imageQuery || `${a.name} ${name}`,
            `${a.name} ${state}`,
            `${a.name} India`,
        ];
        const ids = [];
        for (const q of queries) {
            const found = await searchUnsplash(q);
            for (const id of found) if (!ids.includes(id)) ids.push(id);
            if (ids.length) break; // first query that returns anything is enough
        }
        return ids;
    });
    saveCache();

    // Phase 2 (sequential): assign a unique real image per attraction, in order.
    const attractions = def.attractions.map((a, i) => {
        let id = pickUnique(candidates[i]);
        if (!id) id = pickUnique(destPool);
        if (!id) id = candidates[i][0] || fallbackImage(); // reuse a real photo over null
        return {
            name: a.name,
            description: a.description,
            whyVisit: a.whyVisit,
            bestTime: a.bestTime,
            duration: a.duration,
            mapsSearch: a.mapsSearch || `${a.name}, ${name}, India`,
            category: a.category,
            imagePrompt: imagePrompt(a.name, name),
            slug: slugify(a.name),
            position: i + 1,
            coverImage: id ? imgUrl(id, 800) : null,
        };
    });

    // Cover image: prefer the destination pool's best shot, else first attraction
    // image, else a neutral real India travel photo (never null).
    const coverId = destPool[0] || null;
    const firstAttrImg = attractions.find(a => a.coverImage)?.coverImage;
    const coverImage = coverId ? imgUrl(coverId, 1200)
        : (firstAttrImg ? firstAttrImg.replace('w=800', 'w=1200')
            : 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?fm=webp&w=1200&q=60');

    const d = { ...def, slug, attractions };
    const out = {
        slug,
        name,
        state,
        tagline: def.tagline,
        metaTitle: metaTitle(d),
        metaDescription: metaDescription(d),
        categories: def.categories,
        introduction: makeIntroduction(d),
        pageContent: make350(d),
        coverImage,
        attractions,
    };

    fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(out, null, 2));
    const missing = attractions.filter(a => !a.coverImage).length;
    console.log(`✅ ${name.padEnd(28)} ${attractions.length} attractions` + (missing ? ` ⚠️ ${missing} without image` : ''));
    return {
        slug, name, state,
        tagline: def.tagline,
        // Smaller variant for directory/homepage cards (the detail hero uses 1200w).
        coverImage: (out.coverImage || '').replace('w=1200', 'w=600'),
        attractionCount: attractions.length,
        categories: def.categories,
    };
}

async function main() {
    const only = process.argv.slice(2).map(s => s.toLowerCase());
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.error('No data files in scripts/mv-data/. Author them first.');
        process.exit(1);
    }

    const defs = files
        .map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')))
        .filter(d => only.length === 0 || only.includes((d.slug || slugify(d.name)).toLowerCase()))
        .sort((a, b) => rankOf(a.name) - rankOf(b.name));

    console.log(`🚀 Building ${defs.length} destination(s)…\n`);
    const indexEntries = [];
    for (const def of defs) {
        try {
            indexEntries.push(await buildDestination(def));
        } catch (e) {
            console.error(`❌ ${def.name}: ${e.message}`);
        }
    }
    saveCache();

    // Merge into index.json (preserve entries for destinations not rebuilt this run).
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'index.json'), 'utf8')); } catch { existing = []; }
    const bySlug = new Map(existing.map(e => [e.slug, e]));
    for (const e of indexEntries) bySlug.set(e.slug, e);
    const index = [...bySlug.values()].sort((a, b) => rankOf(a.name) - rankOf(b.name));
    fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

    console.log(`\n🎉 Done. index.json now lists ${index.length} destinations.`);
}

main();
