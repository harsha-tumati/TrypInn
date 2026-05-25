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
                resolve({
                    lat: r.geometry.location.lat(),
                    lng: r.geometry.location.lng(),
                    placeId: r.place_id,
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

// In-memory cache so the same place is only looked up once per session.
// Stores the in-flight promise too, which dedupes concurrent lookups.
const _placeImageCache = new Map();

/**
 * Best-effort: resolve a real Google photo for a place that has none.
 * Tries its googlePlaceId first, then a name+location text search.
 * Returns { imageUrl, imageUrls, rating } or null.
 */
export function fetchPlaceImage(place) {
    const key = place?.googlePlaceId || place?.name;
    if (!key) return Promise.resolve(null);
    if (_placeImageCache.has(key)) return _placeImageCache.get(key);

    const lookup = (async () => {
        try {
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
        } catch (e) {
            console.warn('fetchPlaceImage failed for', place?.name, e);
        }
        return null;
    })();

    _placeImageCache.set(key, lookup);
    // Don't permanently cache a miss — allow a later retry (e.g. once the
    // Places library has finished loading, or after a transient failure).
    lookup.then((res) => { if (!res) _placeImageCache.delete(key); });
    return lookup;
}

/**
 * Find a named place (attraction) via the new Places API text search.
 * Much more accurate than the Geocoder for named tourist spots.
 */
async function findPlaceByName(name, locationBias) {
    if (!name) return null;
    const Place = (await getPlacesLib())?.Place;
    if (!Place) return null;
    try {
        const request = {
            textQuery: name,
            fields: ['id', 'displayName', 'location', 'rating', 'photos'],
            maxResultCount: 1,
        };
        if (locationBias) {
            request.locationBias = { center: locationBias, radius: 50000 };
        }
        const { places } = await Place.searchByText(request);
        const r = places?.[0];
        if (!r) return null;
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

    const promises = places.map(async (place) => {
        try {
            // findPlaceFromText gives us the correct attraction placeId, photos, and location
            const found = await findPlaceByName(place.name, locationBias);
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
            const geo = await geocodePlace(place.name, destination);
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
