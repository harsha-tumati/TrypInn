// Where a newly added place belongs in the trip: the gap in the route where
// visiting it adds the least extra distance. Adding Shimla to Kanpur → Kalpa
// → Kanpur slots it in on the way, instead of tacking it on at the end, so
// the Plan tab's order is already the order the itinerary will visit things
// (and the traveller only drags when they want something different).
//
// Places are only ever put between blocks (a lone stop, or a region with its
// places), never inside a region.

const hasCoords = (p) => p && p.lat != null && p.lng != null;

function km(a, b) {
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The middle of some places — where a whole region sits on the route. */
export function centreOf(places) {
    const pts = places.filter(hasCoords);
    if (!pts.length) return null;
    return {
        lat: pts.reduce((n, p) => n + p.lat, 0) / pts.length,
        lng: pts.reduce((n, p) => n + p.lng, 0) / pts.length,
    };
}

/**
 * Index in `stops` to insert at. `blockStarts` are the indices where each
 * block begins (in order); `start` / `end` are the trip's endpoints (end
 * defaults to start, a round trip). Without coordinates for the new place
 * it goes at the end, as before.
 */
export function bestInsertIndex(stops, blockStarts, point, { start, end } = {}) {
    if (!hasCoords(point) || !blockStarts.length) return stops.length;
    const finish = hasCoords(end) ? end : hasCoords(start) ? start : null;
    // The nearest located stop looking back from i (exclusive) / forward.
    const before = (i) => {
        for (let j = i - 1; j >= 0; j--) if (hasCoords(stops[j])) return stops[j];
        return hasCoords(start) ? start : null;
    };
    const after = (i) => {
        for (let j = i; j < stops.length; j++) if (hasCoords(stops[j])) return stops[j];
        return finish;
    };
    const cost = (i) => {
        const a = before(i), b = after(i);
        if (a && b) return km(a, point) + km(point, b) - km(a, b);
        return a ? km(a, point) : b ? km(point, b) : 0;
    };
    let best = stops.length;
    let bestCost = cost(stops.length);
    for (const i of blockStarts) {
        const c = cost(i);
        if (c < bestCost - 0.01) { best = i; bestCost = c; }
    }
    return best;
}
