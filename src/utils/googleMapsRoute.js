// A Google Maps directions link for the whole trip: from the starting point,
// through each stop in order, to the end. Google Maps links take at most 10
// points (origin + 8 waypoints + destination), so longer trips open their
// first 10 — `truncated` says when that happened.
// https://developers.google.com/maps/documentation/urls/get-started#directions-action
//
// A point with a Google place ID goes in by name + ID, so Google Maps shows
// the real place (name, entrance, opening hours). Bare coordinates open as
// unnamed dropped pins snapped to the nearest road, which look random.
// Waypoint IDs only count when every waypoint has one, so a mixed list falls
// back to coordinates for all the waypoints.

const MAX_POINTS = 10;
const ok = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
const coord = (p) => `${Number(p.lat).toFixed(6)},${Number(p.lng).toFixed(6)}`;
const idOf = (p) => p.googlePlaceId || p.placeId || null;
const enc = encodeURIComponent;

// `placeIds` fills in IDs found later for stops saved without one.
// `fromHere` leaves the origin out, so Google Maps starts from wherever the
// phone is (turn-by-turn during the trip).
export function googleMapsRouteUrl({ start, stops = [], end, placeIds = {}, fromHere = false }) {
    const points = [];
    if (ok(start)) points.push(start);
    for (const s of stops) if (ok(s)) points.push(s);
    if (ok(end) && coord(end) !== coord(points[points.length - 1] || {})) points.push(end);
    // A round trip ends where it starts: keep that, it closes the loop.
    if (points.length < (fromHere ? 1 : 2)) return { url: null, total: points.length, truncated: false };

    const total = points.length;
    const used = points.slice(0, MAX_POINTS).map((p) => ({ p, id: idOf(p) || placeIds[p.id] || null }));
    const origin = fromHere ? null : used[0];
    const destination = used[used.length - 1];
    const waypoints = used.slice(fromHere ? 0 : 1, -1);

    const endpoint = (key, { p, id }) => (id && p.name
        ? `&${key}=${enc(p.name)}&${key}_place_id=${enc(id)}`
        : `&${key}=${coord(p)}`);
    let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving'
        + (origin ? endpoint('origin', origin) : '')
        + endpoint('destination', destination);
    if (waypoints.length) {
        const named = waypoints.every((w) => w.id && w.p.name);
        url += named
            ? `&waypoints=${enc(waypoints.map((w) => w.p.name.replace(/\|/g, ' ')).join('|'))}`
                + `&waypoint_place_ids=${enc(waypoints.map((w) => w.id).join('|'))}`
            : `&waypoints=${enc(waypoints.map((w) => coord(w.p)).join('|'))}`;
    }
    return { url, total, truncated: total > MAX_POINTS };
}
