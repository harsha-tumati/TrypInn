// src/services/placesService.js
// Uses Google Maps JavaScript API (Geocoder + PlacesService) — no CORS issues

/**
 * Get a photo URL from a Google Place photo object.
 */
export function getPlacePhotoUrl(photo, maxWidth = 400) {
    if (!photo) return null;
    if (typeof photo === 'string') return null; // old photo_reference won't work client-side
    if (photo.getUrl) return photo.getUrl({ maxWidth });
    return null;
}

/**
 * Geocode a place name using the Maps JS API Geocoder.
 */
function geocodePlace(name, location) {
    return new Promise((resolve) => {
        if (!window.google?.maps) { resolve(null); return; }
        const geocoder = new window.google.maps.Geocoder();
        let locClean = (location || '').replace(/->|→/g, ' ').split('  ').join(' ').trim();
        if (locClean.length > 30) {
            // For multi-city trips, extract just the first city segment to provide some geographic context
            locClean = locClean.split(/->|→/)[0].trim();
        }
        const address = `${name} ${locClean}`.trim();
        
        geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results?.length > 0) {
                const r = results[0];
                const vp = r.geometry.viewport;
                resolve({
                    lat: r.geometry.location.lat(),
                    lng: r.geometry.location.lng(),
                    placeId: r.place_id,
                    // Corner to corner of the area, for judging what's "nearby".
                    spanKm: vp ? distanceKm(
                        { lat: vp.getNorthEast().lat(), lng: vp.getNorthEast().lng() },
                        { lat: vp.getSouthWest().lat(), lng: vp.getSouthWest().lng() },
                    ) : 0,
                });
            } else {
                resolve(null);
            }
        });
    });
}

// ── New Places API loader ───────────────────────────────────────────────────
// Reliably resolves the `Place` class. importLibrary() loads the Places
// library on demand and is idempotent, so this works no matter the order in
// which components mount. Waits briefly for the Maps bootstrap script.
function waitForMapsBootstrap(timeout = 12000) {
    return new Promise((resolve) => {
        if (window.google?.maps?.importLibrary) { resolve(true); return; }
        const start = Date.now();
        const iv = setInterval(() => {
            if (window.google?.maps?.importLibrary) { clearInterval(iv); resolve(true); }
            else if (Date.now() - start > timeout) { clearInterval(iv); resolve(false); }
        }, 150);
    });
}

let _placesLib = null;
async function getPlacesLib() {
    if (_placesLib) return _placesLib;
    const ready = await waitForMapsBootstrap();
    if (!ready) return null;
    try {
        _placesLib = await window.google.maps.importLibrary('places');
        return _placesLib;
    } catch (e) {
        console.warn('Failed to load the Google Places library', e);
        return null;
    }
}

/**
 * Get place details (rating, photos) using the new Places API (Place class).
 * The legacy PlacesService.getDetails is no longer available to new keys.
 */
export async function getPlaceDetails(placeId) {
    if (!placeId) return null;
    const Place = (await getPlacesLib())?.Place;
    if (!Place) return null;
    try {
        const place = new Place({ id: placeId });
        await place.fetchFields({ fields: ['rating', 'photos', 'displayName'] });
        const photos = place.photos || [];
        return {
            rating: place.rating ?? null,
            imageUrls: photos.slice(0, 5).map(p => p.getURI?.({ maxWidth: 400 })).filter(Boolean),
            imageUrl: photos[0]?.getURI?.({ maxWidth: 400 }) || null,
        };
    } catch (e) {
        console.warn('getPlaceDetails failed for', placeId, e);
        return null;
    }
}

// ── Place photos ────────────────────────────────────────────────────────────
// Thumbnails call Places API (New) over REST rather than through the Maps JS
// library: a fetch can start the moment a thumbnail mounts, instead of first
// waiting for the whole Maps script to download and boot.
const PLACES_KEY = (import.meta.env.VITE_GOOGLE_PLACES_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

async function placesRest(path, fieldMask, body) {
    const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': PLACES_KEY,
            'X-Goog-FieldMask': fieldMask,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Places API ${res.status}`);
    return res.json();
}

function photoResult(photos) {
    const urls = (photos || []).slice(0, 5)
        .map(p => (p?.name ? `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=400&key=${PLACES_KEY}` : null))
        .filter(Boolean);
    return urls.length ? { imageUrl: urls[0], imageUrls: urls } : null;
}

// Name → place id, kept across reloads. Google's terms allow place ids to be
// stored indefinitely (photo URLs may not be), so this is what we persist: on
// the next visit a thumbnail goes straight to its place instead of searching
// for it by name again.
const PLACE_ID_STORE = 'trypinn_place_ids_v1';
const PLACE_ID_LIMIT = 800;
let _placeIds = null;

function placeIds() {
    if (_placeIds) return _placeIds;
    try { _placeIds = JSON.parse(localStorage.getItem(PLACE_ID_STORE)) || {}; } catch { _placeIds = {}; }
    return _placeIds;
}

function rememberPlaceId(key, id) {
    const ids = placeIds();
    if (ids[key] === id) return;
    ids[key] = id;
    const keys = Object.keys(ids);
    if (keys.length > PLACE_ID_LIMIT) keys.slice(0, keys.length - PLACE_ID_LIMIT).forEach(k => delete ids[k]);
    try { localStorage.setItem(PLACE_ID_STORE, JSON.stringify(ids)); } catch { /* storage full or unavailable */ }
}

function placeKey(place) {
    const at = place.lat != null && place.lng != null ? `@${Number(place.lat).toFixed(3)},${Number(place.lng).toFixed(3)}` : '';
    return `${(place.name || '').trim().toLowerCase()}${at}`;
}

// Straight-line distance in km between two { lat, lng }.
function distanceKm(a, b) {
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
}

// A match for a named place this far from where we expected it is a
// different place with the same name ("Rock Beach" in another city). A big
// destination (a state, a country) widens it to its own size.
const MAX_MATCH_KM = 120;
const matchRadiusKm = (geo) => Math.max(MAX_MATCH_KM, geo?.spanKm || 0);
// A saved stop's own place is within a short walk of its pin.
const NEAR_PIN_KM = 3;

/**
 * The Google place ID of a stop saved without one, found by name right
 * around its pin. Used for "Open in Google Maps", so the link names real
 * places instead of dropping pins. Remembered across reloads.
 */
export async function findPlaceIdNear(place) {
    if (!place?.name || place.lat == null || place.lng == null) return null;
    const key = placeKey(place);
    const known = placeIds()[key];
    if (known) return known;
    const pin = { lat: Number(place.lat), lng: Number(place.lng) };
    let found = null;
    if (PLACES_KEY && !_restRefused) {
        try {
            const r = (await placesRest('places:searchText', 'places.id,places.location', {
                textQuery: place.name,
                maxResultCount: 1,
                locationBias: { circle: { center: { latitude: pin.lat, longitude: pin.lng }, radius: 2000 } },
            })).places?.[0];
            if (r?.location) found = { id: r.id, lat: r.location.latitude, lng: r.location.longitude };
        } catch (e) {
            if (/ 40[13]$/.test(e.message)) _restRefused = true;
        }
    }
    if (!found) {
        try {
            const Place = (await getPlacesLib())?.Place;
            const { places } = Place ? await Place.searchByText({
                textQuery: place.name,
                fields: ['id', 'location'],
                locationBias: { center: pin, radius: 2000 },
                maxResultCount: 1,
            }) : { places: [] };
            const r = places?.[0];
            if (r?.location) found = { id: r.id, lat: r.location.lat(), lng: r.location.lng() };
        } catch { /* no ID; the link falls back to coordinates */ }
    }
    if (!found || distanceKm(pin, found) > NEAR_PIN_KM) return null;
    rememberPlaceId(key, found.id);
    return found.id;
}

async function lookupPhotoRest(place) {
    const id = place.googlePlaceId || placeIds()[placeKey(place)];
    if (id) {
        const d = await placesRest(`places/${encodeURIComponent(id)}`, 'photos');
        const r = photoResult(d.photos);
        if (r) return r;
    }
    const body = { textQuery: place.name, maxResultCount: 1 };
    if (place.lat != null && place.lng != null) {
        body.locationBias = { circle: { center: { latitude: Number(place.lat), longitude: Number(place.lng) }, radius: 50000 } };
    }
    const found = (await placesRest('places:searchText', 'places.id,places.photos,places.rating', body)).places?.[0];
    if (!found) return null;
    if (!place.googlePlaceId) rememberPlaceId(placeKey(place), found.id);
    const r = photoResult(found.photos);
    return r && { ...r, rating: found.rating ?? null };
}

// The older path through the Maps JS library — used only if a REST call is
// refused (a key restricted to the JS API, say).
async function lookupPhotoJs(place) {
    if (place.googlePlaceId) {
        const d = await getPlaceDetails(place.googlePlaceId);
        if (d?.imageUrl) return d;
    }
    const bias = (place.lat && place.lng) ? { lat: place.lat, lng: place.lng } : null;
    const found = await findPlaceByName(place.name, bias);
    if (found?.imageUrl) return { imageUrl: found.imageUrl, imageUrls: found.imageUrls, rating: found.rating };
    if (found?.placeId) {
        const d = await getPlaceDetails(found.placeId);
        if (d?.imageUrl) return d;
    }
    return null;
}

// In-memory cache so the same place is only looked up once per session (tab
// switches reuse it). Stores the in-flight promise too, which dedupes
// concurrent lookups.
const _placeImageCache = new Map();
const _resolvedImages = new Map(); // key -> result, for synchronous reads
let _restRefused = false;

/** A photo this session has already found for the place, without waiting. */
export function peekPlaceImage(place) {
    if (!place?.name && !place?.googlePlaceId) return null;
    return _resolvedImages.get(place.googlePlaceId || placeKey(place)) || null;
}

/**
 * Best-effort: resolve a real Google photo for a place that has none.
 * Returns { imageUrl, imageUrls, rating } or null.
 */
export function fetchPlaceImage(place) {
    if (!place?.name && !place?.googlePlaceId) return Promise.resolve(null);
    const key = place.googlePlaceId || placeKey(place);
    if (_placeImageCache.has(key)) return _placeImageCache.get(key);

    const lookup = (async () => {
        if (PLACES_KEY && !_restRefused) {
            try {
                return await lookupPhotoRest(place);
            } catch (e) {
                // A 403 means the key won't take REST calls; stop trying them.
                if (/ 40[13]$/.test(e.message)) _restRefused = true;
            }
        }
        try {
            return await lookupPhotoJs(place);
        } catch (e) {
            console.warn('fetchPlaceImage failed for', place?.name, e);
            return null;
        }
    })();

    _placeImageCache.set(key, lookup);
    // Don't permanently cache a miss — allow a later retry (e.g. once the
    // Places library has finished loading, or after a transient failure).
    lookup.then((res) => {
        if (res) _resolvedImages.set(key, res);
        else _placeImageCache.delete(key);
    });
    return lookup;
}

/**
 * Find a named place (attraction) via the new Places API text search.
 * Much more accurate than the Geocoder for named tourist spots.
 */
async function findPlaceByName(name, locationBias, area = '', maxKm = 0) {
    if (!name) return null;
    const Place = (await getPlacesLib())?.Place;
    if (!Place) return null;
    try {
        // Naming the area keeps "Rock Beach" in Pondicherry, not some other
        // Rock Beach; the bias alone is only a preference.
        const inName = area && name.toLowerCase().includes(area.toLowerCase());
        const request = {
            textQuery: area && !inName ? `${name}, ${area}` : name,
            fields: ['id', 'displayName', 'location', 'rating', 'photos'],
            maxResultCount: 1,
        };
        if (locationBias) {
            request.locationBias = { center: locationBias, radius: 50000 };
        }
        const { places } = await Place.searchByText(request);
        const r = places?.[0];
        if (!r) return null;
        const at = { lat: r.location?.lat?.(), lng: r.location?.lng?.() };
        if (locationBias && at.lat != null && distanceKm(locationBias, at) > (maxKm || MAX_MATCH_KM)) return null;
        const photos = r.photos || [];
        return {
            placeId: r.id,
            imageUrl: photos[0]?.getURI?.({ maxWidth: 400 }) || null,
            imageUrls: photos.slice(0, 5).map(p => p.getURI?.({ maxWidth: 400 })).filter(Boolean),
            rating: r.rating ?? null,
            lat: r.location?.lat?.() ?? null,
            lng: r.location?.lng?.() ?? null,
        };
    } catch (e) {
        console.warn('findPlaceByName failed for', name, e);
        return null;
    }
}

/**
 * Enrich AI-suggested places with real coordinates, ratings, and images.
 * Uses findPlaceFromText (more accurate than Geocoder for named attractions).
 */
export async function enrichPlacesWithGoogle(places, destination) {
    // Geocode the destination once for a location bias
    const destGeo = destination ? await geocodePlace(destination, '').catch(() => null) : null;
    const locationBias = destGeo ? { lat: destGeo.lat, lng: destGeo.lng } : null;
    // One place ("Pondicherry") goes into each search; a route ("Chennai →
    // Pondicherry") spans too much to name, so it only biases.
    const area = destination && !/->|→|\|/.test(destination) && destination.length <= 40 ? destination.trim() : '';
    // A geocoder hit far from the destination is a namesake elsewhere.
    const maxKm = matchRadiusKm(destGeo);
    const nearEnough = (geo) => !geo || !locationBias || distanceKm(locationBias, geo) <= maxKm;

    const promises = places.map(async (place) => {
        try {
            // findPlaceFromText gives us the correct attraction placeId, photos, and location
            const found = await findPlaceByName(place.name, locationBias, area, maxKm);
            if (found?.placeId && !found.imageUrl) {
                // Has placeId but no inline photos — fetch details
                const details = await getPlaceDetails(found.placeId);
                return {
                    ...place,
                    lat: found.lat ?? null,
                    lng: found.lng ?? null,
                    rating: found.rating ?? details?.rating ?? null,
                    googlePlaceId: found.placeId,
                    imageUrls: details?.imageUrls ?? [],
                    imageUrl: details?.imageUrl ?? null,
                    source: 'ai',
                };
            }
            if (found) {
                return {
                    ...place,
                    lat: found.lat ?? null,
                    lng: found.lng ?? null,
                    rating: found.rating ?? null,
                    googlePlaceId: found.placeId ?? null,
                    imageUrls: found.imageUrls ?? [],
                    imageUrl: found.imageUrl ?? null,
                    source: 'ai',
                };
            }
            // Fallback: geocoder
            let geo = await geocodePlace(place.name, destination);
            if (!nearEnough(geo)) geo = null;
            let details = null;
            if (geo?.placeId) details = await getPlaceDetails(geo.placeId);
            return {
                ...place,
                lat: geo?.lat ?? null,
                lng: geo?.lng ?? null,
                rating: details?.rating ?? null,
                googlePlaceId: geo?.placeId ?? null,
                imageUrls: details?.imageUrls ?? [],
                imageUrl: details?.imageUrl ?? null,
                source: 'ai',
            };
        } catch (e) {
            console.warn(`Failed to enrich place: ${place.name}`, e);
            return { ...place, lat: null, lng: null, source: 'ai' };
        }
    });
    return Promise.all(promises);
}

/**
 * Search for nearby places using Google Places JS API Text Search.
 */
export async function searchNearby({ lat, lng, query, radius = 2000 }) {
    if (!query) return [];
    const Place = (await getPlacesLib())?.Place;
    if (!Place) return [];
    try {
        const { places } = await Place.searchByText({
            textQuery: query,
            fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'photos', 'types'],
            locationBias: { center: { lat, lng }, radius },
            maxResultCount: 12,
        });
        return (places || []).map((r) => {
            const photos = r.photos || [];
            return {
                name: typeof r.displayName === 'string' ? r.displayName : (r.displayName?.text || query),
                description: r.formattedAddress || '',
                lat: r.location?.lat?.() ?? null,
                lng: r.location?.lng?.() ?? null,
                rating: r.rating ?? null,
                placeId: r.id,
                imageUrls: photos.slice(0, 5).map(p => p.getURI?.({ maxWidth: 400 })).filter(Boolean),
                imageUrl: photos[0]?.getURI?.({ maxWidth: 400 }) || null,
                source: 'nearby',
                category: r.types?.[0] || 'place',
            };
        });
    } catch (e) {
        console.warn('searchNearby failed for', query, e);
        return [];
    }
}

/**
 * Reverse geocode a lat/lng to get a location name and placeId using JS API.
 */
export function reverseGeocode(lat, lng) {
    return new Promise((resolve) => {
        if (!window.google?.maps) { resolve({ name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, placeId: null }); return; }
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results?.length > 0) {
                const comps = results[0].address_components;
                const city = comps.find(c => c.types.includes('locality'))?.long_name;
                const state = comps.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
                const country = comps.find(c => c.types.includes('country'))?.long_name;
                const name = city ? `${city}, ${state || country}` : state ? `${state}, ${country}` : results[0].formatted_address.split(',').slice(0, 2).join(',');
                resolve({ name, placeId: results[0].place_id });
            } else {
                resolve({ name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, placeId: null });
            }
        });
    });
}

/**
 * Forward geocode an address to get lat/lng using JS API.
 */
export function forwardGeocode(address) {
    return new Promise((resolve) => {
        if (!window.google?.maps) { resolve(null); return; }
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results?.length > 0) {
                const r = results[0];
                const name = r.formatted_address.split(',').slice(0, 2).join(',').trim();
                resolve({
                    lat: r.geometry.location.lat(),
                    lng: r.geometry.location.lng(),
                    name,
                    placeId: r.place_id,
                    formatted: r.formatted_address,
                });
            } else {
                resolve(null);
            }
        });
    });
}

export async function getOptimizedRoute(places) {
    if (!window.google?.maps || places.length < 2) return null;
    const directionsService = new window.google.maps.DirectionsService();

    const origin = { lat: places[0].lat, lng: places[0].lng };
    const destination = { lat: places[places.length - 1].lat, lng: places[places.length - 1].lng };
    const waypoints = places.slice(1, -1).map(p => ({
        location: { lat: p.lat, lng: p.lng },
        stopover: true,
    }));

    try {
        const result = await directionsService.route({
            origin,
            destination,
            waypoints,
            optimizeWaypoints: true,
            travelMode: window.google.maps.TravelMode.DRIVING,
        });
        return {
            directionsResult: result,
            orderedPlaces: [places[0], ...result.routes[0].waypoint_order.map(i => places[i + 1]), places[places.length - 1]],
        };
    } catch (e) {
        console.error("Directions error:", e);
        return null;
    }
}

/**
 * Get route from a specific location (e.g. user live location) to a destination.
 */
export async function getPersonalRoute(originLatLng, destinationPlace) {
    if (!window.google?.maps || !originLatLng || !destinationPlace) return null;
    const directionsService = new window.google.maps.DirectionsService();

    try {
        const result = await directionsService.route({
            origin: originLatLng,
            destination: { lat: destinationPlace.lat, lng: destinationPlace.lng },
            travelMode: window.google.maps.TravelMode.DRIVING,
        });
        return result;
    } catch (e) {
        console.error("Personal directions error:", e);
        return null;
    }
}

// ── Location search (autocomplete) ───────────────────────────────────────────
// Called straight over REST so suggestions start before the Maps JS library
// has loaded, with a per-typing-session token so a search and the place picked
// from it are billed as one session. Falls back to the JS library's legacy
// AutocompleteService when REST is refused for this key.
const _acCache = new Map(); // "query" -> suggestions
let _acRestRefused = false;

export function newPlacesSessionToken() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Suggestions for typed text: [{ placeId, main, secondary }]. */
export async function autocompletePlaces(input, sessionToken) {
    const q = input.trim();
    if (q.length < 1) return [];
    const key = q.toLowerCase();
    if (_acCache.has(key)) return _acCache.get(key);

    let items = null;
    if (PLACES_KEY && !_acRestRefused) {
        try {
            const r = await placesRest('places:autocomplete', '*', { input: q, sessionToken });
            items = (r.suggestions || [])
                .map(s => s.placePrediction)
                .filter(Boolean)
                .map(p => ({
                    placeId: p.placeId,
                    main: p.structuredFormat?.mainText?.text || p.text?.text || '',
                    secondary: p.structuredFormat?.secondaryText?.text || '',
                }));
        } catch (e) {
            if (/ 40[13]$/.test(e.message)) _acRestRefused = true;
            else throw e;
        }
    }
    if (!items) items = await autocompleteJs(q, sessionToken);
    _acCache.set(key, items);
    if (_acCache.size > 200) _acCache.delete(_acCache.keys().next().value);
    return items;
}

async function autocompleteJs(q, sessionToken) {
    const lib = await getPlacesLib();
    if (!lib?.AutocompleteSuggestion) return [];
    const req = { input: q };
    if (lib.AutocompleteSessionToken) req.sessionToken = sessionToken instanceof lib.AutocompleteSessionToken ? sessionToken : new lib.AutocompleteSessionToken();
    const { suggestions = [] } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(req).catch(() => ({}));
    return suggestions.map(s => s.placePrediction).filter(Boolean).map(p => ({
        placeId: p.placeId,
        main: p.mainText?.text || p.text?.text || '',
        secondary: p.secondaryText?.text || '',
    }));
}

/** Coordinates and names for a picked suggestion. */
export async function resolvePlace(placeId, sessionToken) {
    if (PLACES_KEY && !_acRestRefused) {
        try {
            const d = await placesRest(
                `places/${encodeURIComponent(placeId)}${sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : ''}`,
                'id,displayName,formattedAddress,location',
            );
            if (d.location) {
                return {
                    name: d.displayName?.text || d.formattedAddress?.split(',')[0] || '',
                    formatted: d.formattedAddress || '',
                    lat: d.location.latitude,
                    lng: d.location.longitude,
                    placeId: d.id || placeId,
                };
            }
        } catch (e) {
            if (/ 40[13]$/.test(e.message)) _acRestRefused = true;
            else throw e;
        }
    }
    const lib = await getPlacesLib();
    if (!lib?.Place) throw new Error('Places library unavailable');
    const place = new lib.Place({ id: placeId });
    await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
    if (!place.location) throw new Error('Place has no location');
    return {
        name: place.displayName || place.formattedAddress?.split(',')[0] || '',
        formatted: place.formattedAddress || '',
        lat: place.location.lat(),
        lng: place.location.lng(),
        placeId,
    };
}
