// src/utils/geo.js
// A trip's startingPoint / endingPoint may be one of two shapes:
//   • a geocoded place — { name, lat, lng, placeId }  (picked from Google)
//   • a typed-only label — { name }  (captured when Maps is unavailable)
// Map markers and route endpoints can only consume the geocoded shape.
// Guard with hasCoords() before reading .lat / .lng so a typed-only label
// is never used as a coordinate — it would otherwise become {lat: undefined}.
export function hasCoords(point) {
    return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}
