// Must-visit stops on the drive between two places, fetched ahead of time
// and kept. The itinerary starts loading every real drive of the trip in the
// background when it opens, so "Find stops on my route" (and the Plan tab's
// "See must-visits on the way") show them at once instead of a spinner.
//
// Kept in localStorage per leg, since the places along a road don't change.
// A failed fetch is forgotten, so the next click simply asks again.

const STORE = 'trypinn_route_stops_v1';
const pending = new Map(); // key → Promise<places[]>
const MIN_KM = 25; // shorter hops (inside a town or region) have nothing "on the way"

const hasCoords = (p) => p && p.lat != null && p.lng != null;
const keyOf = (from, to) => `${(from || '').trim().toLowerCase()}→${(to || '').trim().toLowerCase()}`;

function km(a, b) {
    const rad = (d) => (d * Math.PI) / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
        + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
}

function remember(key, places) {
    try {
        const all = readStore();
        all[key] = places;
        // Keep the newest 60 legs; old trips' roads fall off.
        const keys = Object.keys(all);
        keys.slice(0, Math.max(0, keys.length - 60)).forEach(k => delete all[k]);
        localStorage.setItem(STORE, JSON.stringify(all));
    } catch { /* storage full or blocked — the in-memory copy still works */ }
}

/**
 * The drives worth asking about: from the start to the first stop, between
 * consecutive stops that aren't in the same region, and on to the end.
 * Each is { from, to } with names and coordinates.
 */
export function routeLegs(stops, start = null, end = null) {
    const points = [
        ...(hasCoords(start) ? [{ ...start, group: null }] : []),
        ...stops.filter(hasCoords),
        ...(hasCoords(end) ? [{ ...end, group: null }] : []),
    ];
    const legs = [];
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        if (a.group && a.group === b.group) continue;
        if (km(a, b) < MIN_KM) continue;
        legs.push({ from: a, to: b });
    }
    return legs;
}

/** Starts loading one leg's stops (once); resolves to them. */
export function routeStopsFor(from, to) {
    const key = keyOf(from?.name, to?.name);
    if (pending.has(key)) return pending.get(key);
    const stored = readStore()[key];
    if (stored?.length) {
        const ready = Promise.resolve(stored);
        pending.set(key, ready);
        return ready;
    }
    const loading = (async () => {
        const [{ getRouteMustVisits }, { enrichPlacesWithGoogle }] = await Promise.all([
            import('../config/openai'),
            import('../services/placesService'),
        ]);
        const r = await getRouteMustVisits(from.name, to.name, []);
        const aiPlaces = r?.suggestions || [];
        if (!aiPlaces.length) throw new Error('No places came back');
        // Anchored halfway between the two, wide enough to reach both.
        const near = hasCoords(from) && hasCoords(to)
            ? { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2, km: km(from, to) }
            : null;
        const places = await enrichPlacesWithGoogle(aiPlaces, from.name, { near }).catch(() => aiPlaces);
        remember(key, places);
        return places;
    })();
    pending.set(key, loading);
    loading.catch(() => pending.delete(key));
    return loading;
}

/** The leg's stops if they were fetched ahead, else null. */
export function prefetchedRouteStops(fromName, toName) {
    const key = keyOf(fromName, toName);
    if (pending.has(key)) return pending.get(key);
    const stored = readStore()[key];
    return stored?.length ? Promise.resolve(stored) : null;
}

/** Warms every leg in the background, a couple at a time. */
export async function prefetchRouteLegs(legs) {
    for (let i = 0; i < legs.length; i += 2) {
        await Promise.allSettled(legs.slice(i, i + 2).map(l => routeStopsFor(l.from, l.to)));
    }
}
