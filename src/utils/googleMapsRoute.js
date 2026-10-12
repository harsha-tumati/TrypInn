// A Google Maps directions link for the whole trip: from the starting point,
// through each stop in order, to the end. Google Maps links take at most 10
// points (origin + 8 waypoints + destination), so longer trips open their
// first 10 — `truncated` says when that happened.
// https://developers.google.com/maps/documentation/urls/get-started#directions-action

const MAX_POINTS = 10;
const ok = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
const coord = (p) => `${Number(p.lat).toFixed(6)},${Number(p.lng).toFixed(6)}`;

export function googleMapsRouteUrl({ start, stops = [], end }) {
    const points = [];
    if (ok(start)) points.push(start);
    for (const s of stops) if (ok(s)) points.push(s);
    if (ok(end) && coord(end) !== coord(points[points.length - 1] || {})) points.push(end);
    // A round trip ends where it starts: keep that, it closes the loop.
    if (points.length < 2) return { url: null, total: points.length, truncated: false };

    const total = points.length;
    const used = points.slice(0, MAX_POINTS);
    const origin = used[0];
    const destination = used[used.length - 1];
    const waypoints = used.slice(1, -1);
    const url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving'
        + `&origin=${coord(origin)}`
        + `&destination=${coord(destination)}`
        + (waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.map(coord).join('|'))}` : '');
    return { url, total, truncated: total > MAX_POINTS };
}
