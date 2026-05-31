// src/pages/TripDetailPage.jsx
// Trip map view — full-screen Google Map with a draggable bottom sheet.
// Rendered as a toggle inside PlannerPage / ItineraryPage; expects to be
// mounted inside an <APIProvider> supplied by the parent page.
import { useState, useEffect, useMemo } from 'react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { getEnRouteSuggestions } from '../config/openai';
import { enrichPlacesWithGoogle, searchNearby, reverseGeocode, getPersonalRoute, getPlaceDetails } from '../services/placesService';
import { addPlaces, togglePlaceSelected, createPoll, deletePlace, updateTripStatus, updateMemberLocation, updatePlaceOrder, updateRouteConfig } from '../services/firestoreService';
import { getOptimizedRoute } from '../services/routeService';
import { hasCoords } from '../utils/geo';
import { MAPS_ENABLED } from '../config/maps';
import Modal from '../components/Modal';
import MapRoute from '../components/MapRoute';
import PlaceAutocomplete from '../components/PlaceAutocomplete';
import BottomSheet from '../components/BottomSheet';
import PlaceThumb from '../components/PlaceThumb';
import { Sparkles, Search, Plus, X, Trash2, ExternalLink, Globe, Navigation, LocateFixed, StopCircle, ArrowUp, ArrowDown, Route as RouteIcon, ChevronLeft } from 'lucide-react';
import { TRENDING } from './TripsPage';
import { useIsMobile } from '../hooks/useIsMobile';

const markerColors = { ai: '#EA4335', food: '#F29900', hidden_gem: '#34A853', nearby: '#4285F4', selected: '#EA4335', pinned: '#EA4335' };

const TABS = [
    { id: 'places', label: 'Places', icon: '📍' },
    { id: 'route', label: 'Route', icon: '🛣️' },
    { id: 'on_the_way', label: 'On route', icon: '🧭' },
    { id: 'nearby', label: 'Nearby', icon: '🔍' },
    { id: 'ai', label: 'AI stops', icon: '✨' },
];

function ImageCarousel({ images, name }) {
    const [idx, setIdx] = useState(0);
    const isMobile = useIsMobile();
    if (!images || images.length === 0) return null;
    const arrowSize = isMobile ? 36 : 24;
    return (
        <div style={{ position: 'relative', width: '100%', height: isMobile ? 140 : 120, borderRadius: 8, overflow: 'hidden', margin: '6px 0', touchAction: 'pan-y' }}>
            <img src={images[idx]} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {images.length > 1 && (
                <>
                    <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i === 0 ? images.length - 1 : i - 1)); }} aria-label="Previous photo" style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: arrowSize, height: arrowSize, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36, minWidth: 36, WebkitTapHighlightColor: 'transparent' }}>‹</button>
                    <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i === images.length - 1 ? 0 : i + 1)); }} aria-label="Next photo" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: arrowSize, height: arrowSize, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36, minWidth: 36, WebkitTapHighlightColor: 'transparent' }}>›</button>
                    <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                        {images.map((_, i) => <div key={i} style={{ width: isMobile ? 8 : 6, height: isMobile ? 8 : 6, borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)' }} />)}
                    </div>
                </>
            )}
        </div>
    );
}

export default function MapView({ onExitMap, exitLabel = 'Back' }) {
    const { selectedTrip, setSelectedTrip, places, routeResult, setRouteResult, members } = useTrip();
    const { user } = useAuth();
    const isMobile = useIsMobile();

    const [loadingEnRoute, setLoadingEnRoute] = useState(false);
    const [, setLoadingRoute] = useState(false);
    const [showTrending, setShowTrending] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [bottomTab, setBottomTab] = useState('places');
    const [sheetSnap, setSheetSnap] = useState('half');
    const [nearbyResults, setNearbyResults] = useState([]);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [pollPlaces, setPollPlaces] = useState([]);
    const [pollModalOpen, setPollModalOpen] = useState(false);
    const [pollTitle, setPollTitle] = useState('');
    const [routeError, setRouteError] = useState('');
    const [aiError, setAiError] = useState('');
    const [addingLoc, setAddingLoc] = useState(false);
    const [temporarySuggestions, setTemporarySuggestions] = useState([]);
    const [detourInfo, setDetourInfo] = useState('');
    const [myLocation, setMyLocation] = useState(null);
    const [personalRouteResult, setPersonalRouteResult] = useState(null);
    const [confirmDeletePlace, setConfirmDeletePlace] = useState(null);
    const [shareOpen, setShareOpen] = useState(false);

    const trip = selectedTrip;
    // Derived straight from the trip — no mirrored state, no sync effect needed.
    const isOptimized = trip?.routeConfig?.optimize ?? true;

    const selectedPlaces = useMemo(() => places.filter((p) => p.selected && p.lat), [places]);
    const allMapPlaces = useMemo(() => places.filter((p) => p.lat), [places]);

    const handleMovePlace = async (index, direction) => {
        if (direction === -1 && index === 0) return;
        if (direction === 1 && index === places.length - 1) return;

        const newPlaces = [...places];
        const temp = newPlaces[index];
        newPlaces[index] = newPlaces[index + direction];
        newPlaces[index + direction] = temp;

        const newOrder = newPlaces.map(p => p.id);
        setSelectedTrip({ ...trip, placeOrder: newOrder });
        await updatePlaceOrder(trip.id, newOrder);
    };

    async function showRoute(optimizeOverride = null) {
        // Only a geocoded starting point counts as a routable endpoint.
        const minPlaces = hasCoords(trip.startingPoint) ? 1 : 2;
        if (selectedPlaces.length < minPlaces) {
            setRouteError(`Select at least ${minPlaces} place${minPlaces > 1 ? 's' : ''} for a route. Currently ${selectedPlaces.length} selected. Tap place cards to select them.`);
            return;
        }
        setLoadingRoute(true);
        setRouteError('');
        try {
            const opt = optimizeOverride !== null ? optimizeOverride : isOptimized;
            const result = await getOptimizedRoute(selectedPlaces, trip.startingPoint || null, opt, trip.endingPoint || null);
            if (result) {
                setRouteResult(result.directionsResult);
                if (opt && result.directionsResult.customOrderedPlaces) {
                    const orderedIds = result.directionsResult.customOrderedPlaces
                        .map(p => p.id)
                        .filter(id => id);
                    const unselectedIds = places.filter(p => !p.selected).map(p => p.id);
                    const newOrder = [...orderedIds, ...unselectedIds];
                    await updatePlaceOrder(trip.id, newOrder);
                }
            } else {
                setRouteError('Could not compute route. Check Google Directions API is enabled.');
            }
        } catch (e) {
            setRouteError(e.message);
        } finally {
            setLoadingRoute(false);
        }
    }

    const handleToggleOptimize = async () => {
        const newVal = !isOptimized;
        setSelectedTrip({ ...trip, routeConfig: { ...trip.routeConfig, optimize: newVal } });
        await updateRouteConfig(trip.id, { optimize: newVal });
        showRoute(newVal);
    };

    // Auto-calculate the route whenever the selected place set changes.
    const selectedPlacesKey = selectedPlaces.map(p => p.id).join(',');
    const minPlacesForRoute = hasCoords(trip?.startingPoint) ? 1 : 2;
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (selectedPlaces.length >= minPlacesForRoute) {
            const liveOptimize = trip?.routeConfig?.optimize ?? false;
            showRoute(liveOptimize);
        } else {
            setRouteResult(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPlacesKey, minPlacesForRoute, trip?.startingPoint?.lat, trip?.routeConfig?.optimize]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Clear stale detour text the moment the selected place changes.
    const detourTargetId = selectedPlace ? (selectedPlace.id ?? selectedPlace.name) : null;
    const [detourTrackedId, setDetourTrackedId] = useState(detourTargetId);
    if (detourTargetId !== detourTrackedId) {
        setDetourTrackedId(detourTargetId);
        setDetourInfo('');
    }

    // Detour Calculator
    useEffect(() => {
        if (!selectedPlace || !routeResult || selectedPlaces.length < 2) return;
        if (selectedPlaces.find(p => p.id === selectedPlace.id || p.name === selectedPlace.name)) return;

        let isMounted = true;
        const calculateDetour = async () => {
            setDetourInfo('Calculating detour...');
            try {
                const nonOptRoute = await getOptimizedRoute(selectedPlaces, trip?.startingPoint || null, false, trip?.endingPoint || null);
                if (!isMounted) return;
                if (!nonOptRoute?.directionsResult) { setDetourInfo('Detour unavailable'); return; }

                let currentDuration = 0;
                nonOptRoute.directionsResult.routes[0].legs.forEach(leg => currentDuration += leg.duration.value);

                const originalOrigin = selectedPlaces[0];
                const originalDest = selectedPlaces[selectedPlaces.length - 1];
                const originalWaypoints = selectedPlaces.slice(1, -1);

                const newRoutePoints = [originalOrigin, ...originalWaypoints, selectedPlace, originalDest];
                const newRoute = await getOptimizedRoute(newRoutePoints, trip?.startingPoint || null, false, trip?.endingPoint || null);
                if (!isMounted) return;

                if (newRoute && newRoute.directionsResult) {
                    let newDuration = 0;
                    newRoute.directionsResult.routes[0].legs.forEach(leg => newDuration += leg.duration.value);
                    const diffMins = Math.round((newDuration - currentDuration) / 60);
                    if (diffMins <= 0) setDetourInfo('Already on your route ✅');
                    else setDetourInfo(`+${diffMins} min${diffMins !== 1 ? 's' : ''} detour`);
                } else {
                    setDetourInfo('Detour unavailable');
                }
            } catch {
                if (isMounted) setDetourInfo('Detour calc failed');
            }
        };
        calculateDetour();
        return () => { isMounted = false; };
    }, [selectedPlace, routeResult, selectedPlaces, trip?.startingPoint, trip?.endingPoint]);

    // When the trip leaves the "active" state, clear live-tracking state.
    const tripActive = trip?.status === 'active';
    const [trackedTripActive, setTrackedTripActive] = useState(tripActive);
    if (tripActive !== trackedTripActive) {
        setTrackedTripActive(tripActive);
        if (!tripActive) {
            setMyLocation(null);
            setPersonalRouteResult(null);
        }
    }

    // Live Geolocation Tracking
    useEffect(() => {
        if (!tripActive || !user) return;
        let watchId;
        let lastUpdate = 0;
        // Wrapped in a function so geolocation's own state updates are not
        // flagged as synchronous setState in the effect body.
        const startTracking = () => {
            if (!('geolocation' in navigator)) {
                setRouteError('Geolocation is not supported by your browser.');
                return;
            }
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const now = Date.now();
                    setMyLocation({ lat: latitude, lng: longitude });
                    if (now - lastUpdate > 10000) {
                        lastUpdate = now;
                        try {
                            await updateMemberLocation(trip.id, user?.uid, latitude, longitude);
                        } catch (e) {
                            console.error('Failed to update location', e);
                        }
                    }
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    setRouteError('Please allow location access to use Live Navigation.');
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
            );
        };
        startTracking();
        return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
    }, [tripActive, trip?.id, user]);

    // Personal Route Calculation
    useEffect(() => {
        if (!tripActive || !myLocation || selectedPlaces.length === 0) return;
        const fetchPersonalRoute = async () => {
            const firstStop = selectedPlaces[0];
            const route = await getPersonalRoute(myLocation, firstStop);
            if (route) setPersonalRouteResult(route);
        };
        fetchPersonalRoute();
    }, [tripActive, selectedPlaces, myLocation]);

    if (!trip) return <div className="page-container"><p>No trip selected.</p></div>;

    // Defensive: the map cannot render without a Google Maps key / APIProvider.
    // Pages already gate on MAPS_ENABLED before mounting MapView; this guards
    // any other caller from crashing.
    if (!MAPS_ENABLED) {
        return (
            <div className="tm-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="tm-empty">
                    <span style={{ fontSize: 38 }} aria-hidden="true">🗺️</span>
                    <strong>Map unavailable</strong>
                    <span>A Google Maps API key isn't configured for this app.</span>
                </div>
            </div>
        );
    }

    const center = hasCoords(trip.startingPoint)
        ? { lat: trip.startingPoint.lat, lng: trip.startingPoint.lng }
        : allMapPlaces.length > 0
            ? { lat: allMapPlaces[0].lat, lng: allMapPlaces[0].lng }
            : { lat: 20.5937, lng: 78.9629 };

    async function fetchEnRouteSuggestions() {
        if (!routeResult || selectedPlaces.length < 2) {
            setAiError('Calculate a route with at least 2 places first before asking for AI suggestions.');
            return;
        }
        setLoadingEnRoute(true);
        setBottomTab('ai');
        if (sheetSnap === 'peek') setSheetSnap('half');
        try {
            const rawSuggestions = await getEnRouteSuggestions(selectedPlaces);
            if (rawSuggestions.en_route_places) {
                const enriched = await enrichPlacesWithGoogle(rawSuggestions.en_route_places);
                const nonOptRoute = await getOptimizedRoute(selectedPlaces, trip?.startingPoint || null, false, trip?.endingPoint || null);
                let currentDuration = 0;
                if (nonOptRoute?.directionsResult) {
                    nonOptRoute.directionsResult.routes[0].legs.forEach(leg => currentDuration += leg.duration.value);
                }
                const toAdd = await Promise.all(enriched.map(async p => {
                    let detourText = '';
                    if (currentDuration > 0) {
                        try {
                            const originalOrigin = selectedPlaces[0];
                            const originalDest = selectedPlaces[selectedPlaces.length - 1];
                            const originalWaypoints = selectedPlaces.slice(1, -1);
                            const newRoutePoints = [originalOrigin, ...originalWaypoints, p, originalDest];
                            const newRoute = await getOptimizedRoute(newRoutePoints, trip?.startingPoint || null, false, trip?.endingPoint || null);
                            if (newRoute?.directionsResult) {
                                let newDuration = 0;
                                newRoute.directionsResult.routes[0].legs.forEach(leg => newDuration += leg.duration.value);
                                const diffMins = Math.round((newDuration - currentDuration) / 60);
                                detourText = diffMins <= 0 ? 'On route ✅' : `+${diffMins} min detour`;
                            } else {
                                detourText = 'Detour calc failed';
                            }
                        } catch (e) {
                            console.error('Detour calc error', e);
                            detourText = 'Detour calc failed';
                        }
                    }
                    return { ...p, isTemp: true, category: 'ai', detourText };
                }));
                setTemporarySuggestions(toAdd);
            } else {
                setAiError('No valid en-route suggestions found.');
            }
        } catch (e) {
            setAiError('Failed to fetch en-route places. Check OpenAI key.');
            console.error(e);
        } finally {
            setLoadingEnRoute(false);
        }
    }

    async function handleNearbySearch(e) {
        e?.preventDefault();
        const query = e?.target?.elements?.nearby?.value;
        if (!query || !query.trim()) return;
        setLoadingNearby(true);
        try {
            const loc = allMapPlaces.length > 0
                ? { lat: allMapPlaces[0].lat, lng: allMapPlaces[0].lng }
                : { lat: 20.5937, lng: 78.9629 };
            const results = await searchNearby({ ...loc, query: query.trim() });
            setNearbyResults(results);
        } catch (e) {
            setRouteError(e.message);
        } finally {
            setLoadingNearby(false);
        }
    }

    async function handlePlaceSelected(place) {
        if (!place) return;
        setAddingLoc(true);
        try {
            await addPlaces(trip.id, [{
                name: place.name,
                description: place.formatted || '',
                lat: place.lat,
                lng: place.lng,
                category: 'place',
                source: 'manual',
                selected: false,
                rating: null,
                googlePlaceId: place.placeId || null,
                imageUrl: place.imageUrl || null,
            }]);
        } catch (e) { setRouteError(e.message); }
        finally { setAddingLoc(false); }
    }

    async function handleMapClick(e) {
        const lat = e.detail.latLng.lat;
        const lng = e.detail.latLng.lng;
        try {
            const { name, placeId } = await reverseGeocode(lat, lng);
            let imageUrl = null;
            if (placeId) {
                const details = await getPlaceDetails(placeId);
                if (details) imageUrl = details.imageUrl;
            }
            await addPlaces(trip.id, [{
                name,
                description: `Clicked location: ${name}`,
                lat, lng,
                category: 'place',
                source: 'map_click',
                selected: false,
                rating: null,
                googlePlaceId: placeId,
                imageUrl,
            }]);
        } catch (e) { console.error(e); }
    }

    async function toggleSelect(place) {
        await togglePlaceSelected(place.id, !place.selected);
    }

    async function addNearbyToMap(place) {
        await addPlaces(trip.id, [{ ...place, selected: false }]);
    }

    const shareUrl = `${window.location.origin}/join/${trip.inviteCode}`;

    async function shareInvite() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join my trip "${trip.name}" on Trypinn`,
                    text: trip.description || `Join my trip "${trip.name}" on Trypinn!`,
                    url: shareUrl,
                });
                return;
            } catch {
                // User cancelled or share failed — fall through to modal
            }
        }
        setShareOpen(true);
    }

    async function handleCreatePoll() {
        if (!user) { setRouteError('Sign in to create a poll.'); return; }
        if (pollPlaces.length < 2) { setRouteError('Select at least 2 places for a poll.'); return; }
        if (!pollTitle.trim()) { setRouteError('Enter a poll title.'); return; }
        await createPoll({ tripId: trip.id, title: pollTitle, placeIds: pollPlaces, createdBy: user?.uid });
        setPollModalOpen(false);
        setPollPlaces([]);
        setPollTitle('');
    }

    function togglePollPlace(placeId) {
        setPollPlaces((prev) => prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId]);
    }

    const selectTab = (id) => { setBottomTab(id); if (sheetSnap === 'peek') setSheetSnap('half'); };

    const routeDistanceKm = routeResult
        ? (routeResult.routes[0]?.legs.reduce((a, l) => a + l.distance.value, 0) / 1000).toFixed(1)
        : null;
    const routeHours = routeResult
        ? Math.round(routeResult.routes[0]?.legs.reduce((a, l) => a + l.duration.value, 0) / 3600)
        : null;

    return (
        <div className="tm-root">
            <Map
                defaultCenter={center}
                defaultZoom={allMapPlaces.length > 0 ? 12 : 5}
                mapId="trypinn-map"
                colorScheme="LIGHT"
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI={true}
                clickableIcons={false}
                onClick={handleMapClick}
            >
                {places.filter((p) => p.lat).map((place) => {
                    let seqLetter = null;
                    if (routeResult?.customOrderedPlaces) {
                        const idx = routeResult.customOrderedPlaces.findIndex(rp => rp.id === place.id);
                        if (idx !== -1) seqLetter = String.fromCharCode(65 + idx);
                    }
                    return (
                        <AdvancedMarker key={place.id} position={{ lat: place.lat, lng: place.lng }} title={place.name} onClick={() => setSelectedPlace(place)}>
                            <Pin
                                background={place.selected ? markerColors.selected : (markerColors[place.category] || markerColors.ai)}
                                glyphColor="#fff"
                                borderColor="transparent"
                                glyph={seqLetter || undefined}
                            />
                        </AdvancedMarker>
                    );
                })}
                {temporarySuggestions.map((place, i) => (
                    <AdvancedMarker key={`temp_${i}`} position={{ lat: place.lat, lng: place.lng }} title={place.name} onClick={() => setSelectedPlace({ ...place, isTemp: true })}>
                        <Pin background="#1E1E3F" glyphColor="#FDE047" borderColor="#FDE047" scale={0.8} />
                    </AdvancedMarker>
                ))}
                {showTrending && TRENDING.filter(t => !allMapPlaces.find(p => p.name === t.name)).map(t => (
                    <AdvancedMarker key={`trending_${t.name}`} position={{ lat: t.lat, lng: t.lng }} onClick={() => setSelectedPlace({ ...t, isTemp: true, category: 'trending', description: 'Popular global destination' })}>
                        <div style={{ background: 'rgba(30, 58, 138,0.85)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: '2px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                            <span>{t.emoji}</span> {t.name.split(',')[0]}
                        </div>
                    </AdvancedMarker>
                ))}
                {nearbyResults.map((p, i) => (
                    <AdvancedMarker key={`nearby_${i}`} position={{ lat: p.lat, lng: p.lng }} title={p.name}>
                        <Pin background={markerColors.nearby} glyphColor="#fff" borderColor="transparent" />
                    </AdvancedMarker>
                ))}
                {selectedPlace && (
                    <InfoWindow position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }} onCloseClick={() => setSelectedPlace(null)}>
                        <div style={{ color: '#000', maxWidth: isMobile ? 280 : 240 }}>
                            <strong>{selectedPlace.name}</strong>
                            {selectedPlace.category === 'hidden_gem' && <span style={{ fontSize: 10, background: '#10B981', color: '#fff', padding: '2px 6px', borderRadius: 10, marginLeft: 6 }}>Hidden Gem</span>}
                            <ImageCarousel images={selectedPlace.imageUrls?.length > 0 ? selectedPlace.imageUrls : (selectedPlace.imageUrl ? [selectedPlace.imageUrl] : [])} name={selectedPlace.name} />
                            <p style={{ fontSize: 12, margin: '4px 0' }}>{selectedPlace.description}</p>
                            {selectedPlace.rating && <p style={{ fontSize: 12 }}>⭐ {selectedPlace.rating}</p>}
                            <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(selectedPlace.name)}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 12, padding: '6px 10px', margin: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1E40AF', border: '1px solid #93C5FD', background: '#EFF6FF', borderRadius: 8, minHeight: 36 }}
                            >
                                <ExternalLink size={12} /> Google Search
                            </a>
                            {detourInfo && (
                                <p style={{ fontSize: 11, color: detourInfo.startsWith('Already') ? '#16a34a' : detourInfo.startsWith('+') ? '#EA580C' : '#888', fontWeight: 700, margin: '4px 0' }}>
                                    🚗 {detourInfo}
                                </p>
                            )}
                            {!selectedPlace.isTemp && (
                                <p style={{ fontSize: 11, color: selectedPlace.selected ? '#16a34a' : '#888', marginBottom: 6 }}>
                                    {selectedPlace.selected ? '✅ Selected for route' : 'Tap the card to select'}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                {selectedPlace.isTemp ? (
                                    <>
                                        <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 12, minHeight: 40 }}
                                            onClick={async () => {
                                                await addPlaces(trip.id, [selectedPlace]);
                                                setTemporarySuggestions(prev => prev.filter(p => p.name !== selectedPlace.name));
                                                setSelectedPlace(null);
                                            }}>
                                            + Add to trip
                                        </button>
                                        <button className="btn btn-danger btn-sm" style={{ fontSize: 12, minHeight: 40 }}
                                            onClick={() => {
                                                setTemporarySuggestions(prev => prev.filter(p => p.name !== selectedPlace.name));
                                                setSelectedPlace(null);
                                            }}>
                                            Dismiss
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 12, minHeight: 40 }}
                                            onClick={() => togglePollPlace(selectedPlace.id)}>
                                            {pollPlaces.includes(selectedPlace.id) ? '🗳 In poll' : '+ Add to poll'}
                                        </button>
                                        <button className="btn btn-danger btn-sm" aria-label="Remove place" style={{ fontSize: 12, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onClick={() => { setConfirmDeletePlace(selectedPlace); setSelectedPlace(null); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </InfoWindow>
                )}
                {routeResult && <MapRoute directionsResult={routeResult} />}
                {personalRouteResult && <MapRoute directionsResult={personalRouteResult} color="#a855f7" isDashed={true} />}

                {hasCoords(trip.startingPoint) && (
                    <AdvancedMarker position={{ lat: trip.startingPoint.lat, lng: trip.startingPoint.lng }} zIndex={90}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #10B981, #059669)', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,0,0,0.3)', fontSize: 16 }}>🏠</div>
                            <div style={{ background: '#10B981', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginTop: 4, whiteSpace: 'nowrap' }}>
                                {trip.startingPoint.name?.split(',')[0] || 'Start'}
                            </div>
                        </div>
                    </AdvancedMarker>
                )}
                {hasCoords(trip.endingPoint) && (
                    <AdvancedMarker position={{ lat: trip.endingPoint.lat, lng: trip.endingPoint.lng }} zIndex={90}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,0,0,0.3)', fontSize: 16 }}>🏁</div>
                            <div style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginTop: 4, whiteSpace: 'nowrap' }}>
                                {trip.endingPoint.name?.split(',')[0] || 'End'}
                            </div>
                        </div>
                    </AdvancedMarker>
                )}

                {trip.status === 'active' && members.map(m => {
                    if (!m.currentLocation) return null;
                    const isMe = m.uid === user?.uid;
                    return (
                        <AdvancedMarker key={`member_${m.uid}`} position={{ lat: m.currentLocation.lat, lng: m.currentLocation.lng }} zIndex={100}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {isMe && <div style={{ position: 'absolute', width: 30, height: 30, background: 'rgba(59, 130, 246, 0.4)', borderRadius: '50%', animation: 'pulse 2s infinite' }} />}
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isMe ? '#3B82F6' : '#10B981', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 2, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
                                    {m.photoURL ? <img src={m.photoURL} alt={m.displayName} style={{ width: '100%', height: '100%' }} /> : <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{m.displayName?.charAt(0) || 'U'}</span>}
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, marginTop: 4, whiteSpace: 'nowrap' }}>
                                    {isMe ? 'You' : m.displayName?.split(' ')[0]}
                                </div>
                            </div>
                        </AdvancedMarker>
                    );
                })}
            </Map>

            {/* Back to the Plan / Itinerary screen — top-right */}
            {onExitMap && (
                <button className="tm-back" onClick={onExitMap} aria-label={`Back to ${exitLabel}`}>
                    <ChevronLeft size={17} aria-hidden="true" /> {exitLabel}
                </button>
            )}

            {/* Floating controls — top-left */}
            <div className="tm-controls">
                <button className="tm-ctrl" onClick={fetchEnRouteSuggestions} disabled={loadingEnRoute} title="AI stops on your route" aria-label="Find AI stops on your route">
                    {loadingEnRoute ? <span className="spinner spinner-sm" /> : <Sparkles size={20} />}
                </button>
                <button className={`tm-ctrl${isOptimized ? ' active' : ''}`} onClick={handleToggleOptimize} title={isOptimized ? 'Route optimized' : 'Optimize route'} aria-label="Optimize route" aria-pressed={isOptimized}>
                    <RouteIcon size={20} />
                </button>
                <button className={`tm-ctrl${showTrending ? ' active' : ''}`} onClick={() => setShowTrending(v => !v)} title="Trending destinations" aria-label="Toggle trending destinations" aria-pressed={showTrending}>
                    <Globe size={20} />
                </button>
            </div>

            {/* Toasts — top-center */}
            {trip.status === 'active' && myLocation && (
                <div className="tm-toast tm-toast-live">
                    <LocateFixed size={14} aria-hidden="true" /> Broadcasting location
                </div>
            )}
            {(routeError || aiError) && (
                <div className={`tm-toast ${routeError ? 'tm-toast-error' : 'tm-toast-warn'}`}>
                    <span>{routeError || aiError}</span>
                    <button onClick={() => { setRouteError(''); setAiError(''); }} aria-label="Dismiss"><X size={14} /></button>
                </div>
            )}

            {/* Bottom sheet */}
            <BottomSheet snap={sheetSnap} onSnapChange={setSheetSnap}>
                <div className="tm-tabs" role="tablist">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={bottomTab === t.id}
                            className={`tm-tab${bottomTab === t.id ? ' active' : ''}`}
                            onClick={() => selectTab(t.id)}
                        >
                            <span className="tm-tab-ico" aria-hidden="true">{t.icon}</span>
                            <span>{t.label}</span>
                            {t.id === 'ai' && temporarySuggestions.length > 0 && (
                                <span className="tm-tab-badge">{temporarySuggestions.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="tm-sheet-body">
                    {bottomTab === 'places' && (
                        <>
                            <div style={{ position: 'relative', marginBottom: 14 }}>
                                <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
                                <PlaceAutocomplete
                                    onPlaceSelected={handlePlaceSelected}
                                    placeholder="Search a place to add…"
                                    style={{ width: '100%', background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '13px 16px 13px 40px', fontSize: 15, outline: 'none' }}
                                />
                                {addingLoc && <div className="spinner spinner-sm" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />}
                            </div>

                            {places.length === 0 ? (
                                <div className="tm-empty">
                                    <span style={{ fontSize: 38 }}>📍</span>
                                    <strong>No places yet</strong>
                                    <span>Tap the map or search above to add places.</span>
                                </div>
                            ) : (
                                <div className="tm-list">
                                    {places.map((p, index) => (
                                        <div key={p.id} className={`tm-card${p.selected ? ' selected' : ''}`} onClick={() => toggleSelect(p)}>
                                            <PlaceThumb place={p} size={60} />
                                            <div className="tm-card-main">
                                                <div className="tm-card-name">{p.name}</div>
                                                {p.description && <div className="tm-card-desc">{p.description}</div>}
                                                <div className="tm-card-meta">
                                                    <span className="tm-chip" style={{ textTransform: 'capitalize' }}>{p.category || 'place'}</span>
                                                    {p.rating && <span className="tm-chip amber">⭐ {p.rating}</span>}
                                                    <span className={`tm-chip${p.selected ? ' on' : ''}`}>{p.selected ? '✓ In route' : 'Tap to select'}</span>
                                                </div>
                                            </div>
                                            <div className="tm-card-actions" onClick={(e) => e.stopPropagation()}>
                                                <button className="tm-icon-btn" onClick={() => handleMovePlace(index, -1)} disabled={index === 0} aria-label="Move up"><ArrowUp size={15} /></button>
                                                <button className="tm-icon-btn" onClick={() => handleMovePlace(index, 1)} disabled={index === places.length - 1} aria-label="Move down"><ArrowDown size={15} /></button>
                                                <button className="tm-icon-btn" onClick={() => togglePollPlace(p.id)} aria-label="Add to poll" title={pollPlaces.includes(p.id) ? 'In poll' : 'Add to poll'}>
                                                    <span style={{ fontSize: 14 }}>{pollPlaces.includes(p.id) ? '🗳' : '＋'}</span>
                                                </button>
                                                <button className="tm-icon-btn danger" onClick={() => setConfirmDeletePlace(p)} aria-label={`Remove ${p.name}`}><Trash2 size={15} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {bottomTab === 'route' && (
                        routeResult ? (
                            <>
                                <div className="tm-stats">
                                    <div><div className="tm-stat-v">{routeDistanceKm} km</div><div className="tm-stat-l">Distance</div></div>
                                    <div><div className="tm-stat-v">~{routeHours} hr</div><div className="tm-stat-l">Drive time</div></div>
                                    <div><div className="tm-stat-v">{routeResult.customOrderedPlaces?.length || selectedPlaces.length}</div><div className="tm-stat-l">Stops</div></div>
                                </div>
                                <div className="tm-list" style={{ marginTop: 6 }}>
                                    {routeResult.customOrderedPlaces?.map((p, index) => {
                                        const leg = routeResult.routes?.[0]?.legs[index];
                                        return (
                                            <div key={p.id || index}>
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                    <div className="tm-seq">{String.fromCharCode(65 + index)}</div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className="tm-card-name">{p.name}</div>
                                                        <div className="tm-card-desc" style={{ textTransform: 'capitalize' }}>{p.category || 'Location'}</div>
                                                    </div>
                                                </div>
                                                {leg && (
                                                    <div className="tm-leg">🚗 {leg.duration.text} · {leg.distance.text}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="tm-empty">
                                <span style={{ fontSize: 38 }}>🛣️</span>
                                <strong>No route yet</strong>
                                <span>Select at least two places in the Places tab to build a route.</span>
                            </div>
                        )
                    )}

                    {bottomTab === 'on_the_way' && (
                        <div className="tm-empty">
                            <span style={{ fontSize: 38 }}>🧭</span>
                            <strong>Discover en-route stops</strong>
                            <span>
                                Let AI scan your route
                                {selectedPlaces.length >= 2 && <> from <b>{selectedPlaces[0]?.name?.split(',')[0]}</b> to <b>{selectedPlaces[selectedPlaces.length - 1]?.name?.split(',')[0]}</b></>}
                                {' '}and suggest worthwhile detours.
                            </span>
                            <button className="btn btn-accent" style={{ marginTop: 6 }} onClick={fetchEnRouteSuggestions} disabled={loadingEnRoute}>
                                {loadingEnRoute ? <span className="spinner spinner-sm" /> : <><Sparkles size={15} /> Find stops on the way</>}
                            </button>
                        </div>
                    )}

                    {bottomTab === 'nearby' && (
                        <>
                            <form id="nearby-form" onSubmit={handleNearbySearch} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <input className="input-field" name="nearby" placeholder="cafe, museum, beach…" style={{ flex: 1, minHeight: 46 }} />
                                <button className="btn btn-primary" type="submit" aria-label="Search nearby" style={{ minHeight: 46, minWidth: 50 }}>
                                    {loadingNearby ? <span className="spinner spinner-sm" /> : <Search size={16} />}
                                </button>
                            </form>
                            <div className="tm-quickrow">
                                {['Restaurants', 'Cafes', 'Hotels', 'Gas Stations', 'Museums', 'Parks'].map(term => (
                                    <button key={term} className="tm-quickchip" onClick={() => {
                                        const form = document.getElementById('nearby-form');
                                        if (form) {
                                            form.elements.nearby.value = term;
                                            handleNearbySearch({ preventDefault: () => { }, target: form });
                                        }
                                    }}>{term}</button>
                                ))}
                            </div>
                            <div className="tm-list">
                                {nearbyResults.map((p, i) => (
                                    <div key={i} className="tm-card">
                                        <PlaceThumb place={p} size={60} />
                                        <div className="tm-card-main">
                                            <div className="tm-card-name">{p.name}</div>
                                            {p.description && <div className="tm-card-desc">{p.description}</div>}
                                            {p.rating && <div className="tm-card-meta"><span className="tm-chip amber">⭐ {p.rating}</span></div>}
                                        </div>
                                        <div className="tm-card-actions" onClick={(e) => e.stopPropagation()}>
                                            <button className="tm-icon-btn" onClick={() => addNearbyToMap(p)} aria-label={`Add ${p.name}`}><Plus size={15} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {bottomTab === 'ai' && (
                        loadingEnRoute ? (
                            <div className="tm-empty">
                                <span className="spinner" />
                                <span>Scanning your route for great stops…</span>
                            </div>
                        ) : temporarySuggestions.length === 0 ? (
                            <div className="tm-empty">
                                <span style={{ fontSize: 38 }}>✨</span>
                                <strong>No AI stops yet</strong>
                                <span>Tap the ✨ button on the map to find interesting stops along your route.</span>
                            </div>
                        ) : (
                            <div className="tm-list">
                                {temporarySuggestions.map((p, i) => (
                                    <div key={`temp_${i}`} className="tm-card ai">
                                        <PlaceThumb place={p} size={60} />
                                        <div className="tm-card-main">
                                            <div className="tm-card-name">{p.name}</div>
                                            {p.description && <div className="tm-card-desc">{p.description}</div>}
                                            <div className="tm-card-meta">
                                                <span className="tm-chip ai">✨ AI pick</span>
                                                {p.detourText && <span className={`tm-chip${p.detourText.includes('✅') ? ' on' : ' amber'}`}>⏱ {p.detourText}</span>}
                                            </div>
                                        </div>
                                        <div className="tm-card-actions" onClick={(e) => e.stopPropagation()}>
                                            <button className="tm-icon-btn" onClick={async () => {
                                                await addPlaces(trip.id, [p]);
                                                setTemporarySuggestions(prev => prev.filter(x => x.name !== p.name));
                                            }} aria-label={`Add ${p.name}`}><Plus size={15} /></button>
                                            <button className="tm-icon-btn danger" onClick={() => {
                                                setTemporarySuggestions(prev => prev.filter(x => x.name !== p.name));
                                            }} aria-label="Dismiss"><X size={15} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>

                <div className="tm-sheet-footer">
                    {trip.status !== 'active' ? (
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => updateTripStatus(trip.id, 'active')}>
                            <Navigation size={16} /> Start Navigation
                        </button>
                    ) : (
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => updateTripStatus(trip.id, 'planning')}>
                            <StopCircle size={16} /> End Trip
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={shareInvite}>Share</button>
                </div>
            </BottomSheet>

            {/* Create Poll Modal */}
            <Modal open={pollModalOpen} onClose={() => setPollModalOpen(false)} title="Create Poll 🗳️" subtitle={`${pollPlaces.length} places selected`}>
                <input className="input-field" placeholder="Poll title (e.g. Where should we eat?)" value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} />
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={() => setPollModalOpen(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleCreatePoll}>Create Poll</button>
                </div>
            </Modal>

            {/* Delete Confirm Modal */}
            <Modal open={!!confirmDeletePlace} onClose={() => setConfirmDeletePlace(null)} title="Remove Place?" subtitle={confirmDeletePlace?.name}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
                    This will permanently remove <strong style={{ color: 'var(--text-primary)' }}>{confirmDeletePlace?.name}</strong> from this trip. This can't be undone.
                </p>
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={() => setConfirmDeletePlace(null)}>Cancel</button>
                    <button className="btn btn-danger" onClick={async () => { await deletePlace(confirmDeletePlace.id); setConfirmDeletePlace(null); }}>Remove</button>
                </div>
            </Modal>

            {/* Share Modal */}
            <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share Trip Invite">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                        Anyone with this link can view the trip overview and join.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            readOnly
                            value={shareUrl}
                            onClick={(e) => e.target.select()}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc', outline: 'none' }}
                        />
                        <button
                            onClick={() => { navigator.clipboard.writeText(shareUrl); setAiError('✅ Link copied!'); setTimeout(() => setAiError(''), 2000); setShareOpen(false); }}
                            style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44, whiteSpace: 'nowrap' }}
                        >
                            Copy Link
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a href={`https://wa.me/?text=${encodeURIComponent(`Join my trip "${trip.name}" on Trypinn! ${shareUrl}`)}`} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#22c55e', color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'center', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            WhatsApp
                        </a>
                        <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Join my trip "${trip.name}" on Trypinn!`)}`} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#3b82f6', color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'center', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Telegram
                        </a>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
