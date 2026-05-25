// src/services/routeService.js
// Uses Google Maps JavaScript API DirectionsService (no CORS issues)
import { hasCoords } from '../utils/geo';

/**
 * Get optimized route among selected places using JS API DirectionsService.
 * @param {Array} places - Array of places
 * @param {Object} startingPoint - Optional starting point
 * @param {boolean} optimize - Whether to optimize waypoints (default: true)
 */
export async function getOptimizedRoute(places, startingPoint = null, optimize = true, endingPoint = null) {
    if (!places || places.length < 1) return null;
    const validPlaces = places.filter((p) => p.lat && p.lng);
    if (validPlaces.length < 1) return null;

    // A typed-only location (no coordinates) cannot be a route endpoint —
    // drop it so routing falls back to the selected places instead of
    // sending {lat: undefined} to the Directions API.
    if (!hasCoords(startingPoint)) startingPoint = null;
    if (!hasCoords(endingPoint)) endingPoint = null;

    if (!startingPoint && !endingPoint && validPlaces.length < 2) return null;

    if (!window.google?.maps) {
        throw new Error('Google Maps not loaded yet. Please wait and try again.');
    }

    const directionsService = new window.google.maps.DirectionsService();

    let origin, destination, waypoints;
    let waypointsArrForMapping = [];

    if (startingPoint && endingPoint) {
        origin = { lat: startingPoint.lat, lng: startingPoint.lng };
        destination = { lat: endingPoint.lat, lng: endingPoint.lng };
        waypointsArrForMapping = validPlaces;
        waypoints = waypointsArrForMapping.map((p) => ({ location: { lat: p.lat, lng: p.lng }, stopover: true }));
    } else if (startingPoint && !endingPoint) {
        // Start from starting point, end at last selected place
        origin = { lat: startingPoint.lat, lng: startingPoint.lng };
        if (validPlaces.length > 0) {
            destination = { lat: validPlaces[validPlaces.length - 1].lat, lng: validPlaces[validPlaces.length - 1].lng };
            waypointsArrForMapping = validPlaces.slice(0, -1);
            waypoints = waypointsArrForMapping.map((p) => ({ location: { lat: p.lat, lng: p.lng }, stopover: true }));
        } else {
            destination = origin;
            waypoints = [];
        }
    } else if (!startingPoint && endingPoint) {
        // Start from first selected place, end at ending point
        if (validPlaces.length > 0) {
            origin = { lat: validPlaces[0].lat, lng: validPlaces[0].lng };
            destination = { lat: endingPoint.lat, lng: endingPoint.lng };
            waypointsArrForMapping = validPlaces.slice(1);
            waypoints = waypointsArrForMapping.map((p) => ({ location: { lat: p.lat, lng: p.lng }, stopover: true }));
        } else {
            origin = { lat: endingPoint.lat, lng: endingPoint.lng };
            destination = origin;
            waypoints = [];
        }
    } else {
        // Linear trip: first place → waypoints → last place
        origin = { lat: validPlaces[0].lat, lng: validPlaces[0].lng };
        destination = { lat: validPlaces[validPlaces.length - 1].lat, lng: validPlaces[validPlaces.length - 1].lng };
        waypointsArrForMapping = validPlaces.slice(1, -1);
        waypoints = waypointsArrForMapping.map((p) => ({ location: { lat: p.lat, lng: p.lng }, stopover: true }));
    }

    return new Promise((resolve, reject) => {
        directionsService.route(
            {
                origin,
                destination,
                waypoints,
                optimizeWaypoints: optimize,
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === 'OK' && result.routes?.length > 0) {
                    const route = result.routes[0];
                    const order = optimize && route.waypoint_order && route.waypoint_order.length > 0
                        ? route.waypoint_order 
                        : waypoints.map((_, idx) => idx);

                    let orderedPlaces = [];
                    if (startingPoint && endingPoint) {
                        orderedPlaces = [
                            { name: startingPoint.name || 'Start', lat: startingPoint.lat, lng: startingPoint.lng, isStartingPoint: true },
                            ...order.map(idx => waypointsArrForMapping[idx]),
                            { name: endingPoint.name || 'End', lat: endingPoint.lat, lng: endingPoint.lng, isEndingPoint: true }
                        ];
                    } else if (startingPoint && !endingPoint) {
                        orderedPlaces = [
                            { name: startingPoint.name || 'Start', lat: startingPoint.lat, lng: startingPoint.lng, isStartingPoint: true },
                            ...order.map(idx => waypointsArrForMapping[idx])
                        ];
                        if (validPlaces.length > 0) orderedPlaces.push(validPlaces[validPlaces.length - 1]);
                    } else if (!startingPoint && endingPoint) {
                        if (validPlaces.length > 0) orderedPlaces.push(validPlaces[0]);
                        orderedPlaces = [
                            ...orderedPlaces,
                            ...order.map(idx => waypointsArrForMapping[idx]),
                            { name: endingPoint.name || 'End', lat: endingPoint.lat, lng: endingPoint.lng, isEndingPoint: true }
                        ];
                    } else {
                        orderedPlaces = [
                            validPlaces[0],
                            ...order.map(idx => waypointsArrForMapping[idx]),
                            validPlaces[validPlaces.length - 1]
                        ];
                    }

                    result.customOrderedPlaces = orderedPlaces;
                    
                    resolve({
                        polyline: route.overview_polyline,
                        legs: route.legs.map((leg) => ({
                            distance: leg.distance.text,
                            duration: leg.duration.text,
                            startAddress: leg.start_address,
                            endAddress: leg.end_address,
                        })),
                        waypointOrder: route.waypoint_order,
                        directionsResult: result, // for rendering on map
                    });
                } else {
                    reject(new Error(`Directions failed: ${status}`));
                }
            }
        );
    });
}

/**
 * Compute consecutive-leg drive durations for an ordered list of points,
 * using the new Routes API (RouteMatrix.computeRouteMatrix). No dependency on
 * the deprecated DistanceMatrixService. On failure it resolves to an empty
 * array — callers degrade gracefully (drive time simply shows 0).
 * @param {Array<{lat:number,lng:number}>} points - ordered route points
 * @returns {Promise<Array<{duration:number,distanceMeters:number|null,ok:boolean}>>}
 *          one entry per leg i (points[i] → points[i+1]); duration in seconds
 */
export async function computeLegDurations(points) {
    const pts = (points || []).filter((p) => p && p.lat != null && p.lng != null);
    if (pts.length < 2) return [];
    const origins = pts.slice(0, -1);
    const destinations = pts.slice(1);
    const coords = (arr) => arr.map((p) => ({ lat: p.lat, lng: p.lng }));

    try {
        if (!window.google?.maps?.importLibrary) return [];
        const { RouteMatrix } = await window.google.maps.importLibrary('routes');
        if (!RouteMatrix?.computeRouteMatrix) return [];
        const { matrix } = await RouteMatrix.computeRouteMatrix({
            origins: coords(origins),
            destinations: coords(destinations),
            travelMode: 'DRIVING',
            // The new Routes API requires an explicit response field mask.
            fields: ['durationMillis', 'distanceMeters', 'condition'],
        });
        console.log('computeRouteMatrix matrix:', matrix);
        const legs = [];
        for (let i = 0; i < origins.length; i++) {
            // We only need the diagonal — leg i is origins[i] → destinations[i].
            const item = matrix?.rows?.[i]?.items?.[i];
            if (item && item.durationMillis != null && item.condition !== 'ROUTE_NOT_FOUND') {
                legs.push({
                    duration: Math.round(item.durationMillis / 1000),
                    distanceMeters: item.distanceMeters ?? null,
                    ok: true,
                });
            } else {
                legs.push({ duration: 0, distanceMeters: null, ok: false });
            }
        }
        return legs;
    } catch (e) {
        console.warn('RouteMatrix.computeRouteMatrix failed', e);
        return [];
    }
}

/**
 * Decode a Google Maps encoded polyline into lat/lng coordinate array.
 */
export function decodePolyline(encoded) {
    if (!encoded) return [];
    // If it's already a JS API polyline object, use its method
    if (typeof encoded !== 'string' && window.google?.maps?.geometry) {
        return window.google.maps.geometry.encoding.decodePath(encoded).map(p => ({ lat: p.lat(), lng: p.lng() }));
    }
    // Manual decode for string polylines
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift, result;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
}
