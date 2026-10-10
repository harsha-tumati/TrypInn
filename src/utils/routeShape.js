// src/utils/routeShape.js
// A trip's route, boiled down for its cover art: the stops' coordinates in
// order, rounded and capped. Stored on the trip (trip.routeShape) so a trip
// card can draw the route without reading the trip's places.

const MAX_POINTS = 16;

/** [{lat, lng}] from places or planner stops, in their given order. */
export function routeShapeFrom(stops) {
    const located = (stops || []).filter(s => s && s.lat != null && s.lng != null && !s.skipInRoute);
    // Keep the first and last, sample evenly in between.
    const picked = located.length <= MAX_POINTS
        ? located
        : Array.from({ length: MAX_POINTS }, (_, i) => located[Math.round(i * (located.length - 1) / (MAX_POINTS - 1))]);
    return picked.map(s => ({ lat: Math.round(Number(s.lat) * 1000) / 1000, lng: Math.round(Number(s.lng) * 1000) / 1000 }));
}

/** Places ordered by the trip's placeOrder; unordered ones keep their order after. */
export function orderPlaces(places, placeOrder) {
    if (!placeOrder?.length) return places;
    const rank = new Map(placeOrder.map((id, i) => [id, i]));
    return [...places].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}
