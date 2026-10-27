// Places to explore in an area, fetched ahead of time. When someone answers
// "Where to?" with Goa and moves on to the dates, Goa's places start loading
// in the background, so "Explore Goa" on the Plan tab opens with them ready
// instead of a spinner.
//
// Results are kept for the browser session (a reload keeps them too). A
// failed fetch is forgotten, so the explorer simply asks again itself.

const STORE = 'trypinn_region_prefetch_v1';
const pending = new Map(); // key → Promise<places[]>

const keyOf = (label) => (label || '').trim().toLowerCase();

// "goa, india" → "Goa". The region's name is the group's heading on the
// Plan tab, and what its explorer is keyed by.
export function regionLabel(text) {
    const first = (text || '').split(',')[0].trim();
    return first === first.toLowerCase() ? first.replace(/\b\w/g, c => c.toUpperCase()) : first;
}

function readStore() {
    try { return JSON.parse(sessionStorage.getItem(STORE) || '{}'); } catch { return {}; }
}

function remember(key, places) {
    try {
        const all = readStore();
        all[key] = places;
        sessionStorage.setItem(STORE, JSON.stringify(all));
    } catch { /* storage full or blocked — the in-memory copy still works */ }
}

/** Starts loading an area's places (once); resolves to them. */
export function prefetchRegion(name) {
    const key = keyOf(regionLabel(name));
    if (!key) return Promise.resolve([]);
    if (pending.has(key)) return pending.get(key);
    const stored = readStore()[key];
    if (stored?.length) {
        const ready = Promise.resolve(stored);
        pending.set(key, ready);
        return ready;
    }
    const loading = (async () => {
        const [{ getRegionPlaces }, { enrichPlacesWithGoogle }] = await Promise.all([
            import('../config/openai'),
            import('../services/placesService'),
        ]);
        const r = await getRegionPlaces(name, []);
        const aiPlaces = r?.places || [];
        if (!aiPlaces.length) throw new Error('No places came back');
        const places = await enrichPlacesWithGoogle(aiPlaces, name).catch(() => aiPlaces);
        remember(key, places);
        return places;
    })();
    pending.set(key, loading);
    loading.catch(() => pending.delete(key));
    return loading;
}

/** The places for an area label if they were fetched ahead, else null. */
export function prefetchedRegion(label) {
    const key = keyOf(label);
    if (pending.has(key)) return pending.get(key);
    const stored = readStore()[key];
    return stored?.length ? Promise.resolve(stored) : null;
}
