// src/pages/ItineraryPage.jsx
import { Fragment, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { getOptimizedRoute, computeLegDurations } from '../services/routeService';
import { hasCoords } from '../utils/geo';
import { getSuggestions, getPlaceVisitDurations } from '../config/openai';
import { enrichPlacesWithGoogle } from '../services/placesService';
import { addPlaces, updatePlaceOrder, updatePlaceDuration, updateRouteConfig, updateTrip, claimTrip } from '../services/firestoreService';
import { useGuestMode } from '../context/GuestModeContext';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { isTripClaimed, removeDraftId } from '../utils/draftTrips';
import { GripVertical, Clock, MapPin, ArrowRight, ChevronUp, ChevronDown, Map as MapIcon, Sparkles, BookmarkPlus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import MapsProvider from '../components/MapsProvider';
import { MAPS_ENABLED } from '../config/maps';
import Modal from '../components/Modal';
import { useIsMobile } from '../hooks/useIsMobile';
import MapView from './TripDetailPage';
import PlaceThumb from '../components/PlaceThumb';
import usePageSeo from '../hooks/usePageSeo';

// ── Keeping the schedule steady ─────────────────────────────────────────────
// Leaving this tab unmounts the page. Without help it came back blank and
// rebuilt itself — default durations, no route, then the route and AI timings
// landing a moment later — so breaks appeared, moved and vanished, and every
// edit was lost. Two things fix that:
//   • sessionState / routeCache keep everything for the session, so coming
//     back to the tab restores the page exactly, with no recalculation;
//   • the person's edits are saved on the trip (trip.schedule), so they also
//     survive a reload and reach the trip's other members.

const sessionState = new Map(); // tripId -> last state of this page
const routeCache = new Map();   // route signature -> directions result
const ROUTE_CACHE_LIMIT = 30;

const asSet = (list) => new Set(list || []);
const asFlags = (list) => Object.fromEntries((list || []).map(k => [k, true]));
const flagsOf = (obj) => Object.keys(obj || {}).filter(k => obj[k]).sort();

/** JSON with sorted keys — Firestore doesn't keep map keys in order. */
function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value ?? null);
}

/** The schedule edits a person has made, in the shape saved on the trip. */
function scheduleOf({ dayStartTime, placeDurations, userOverrides, cancelledBreaks, deletedBreaks, manualBreaks, forcedDayBreaks, forcedDayMerges, removedNightStays }) {
    const durations = {};
    Object.keys(userOverrides).forEach(id => {
        if (userOverrides[id] && placeDurations[id] != null) durations[id] = placeDurations[id];
    });
    return {
        dayStartTime,
        durations,
        cancelledBreaks: flagsOf(cancelledBreaks),
        deletedBreaks: flagsOf(deletedBreaks),
        manualBreaks: manualBreaks || {},
        forcedDayBreaks: [...forcedDayBreaks].sort(),
        forcedDayMerges: [...forcedDayMerges].sort(),
        removedNightStays: [...removedNightStays].sort(),
    };
}

/** Page state seeded from what's saved on the trip. */
function stateFromTrip(trip) {
    const saved = trip?.schedule || {};
    const durations = saved.durations || {};
    return {
        dayStartTime: saved.dayStartTime || '09:00',
        placeDurations: { ...durations },
        userOverrides: asFlags(Object.keys(durations)),
        cancelledBreaks: asFlags(saved.cancelledBreaks),
        deletedBreaks: asFlags(saved.deletedBreaks),
        manualBreaks: saved.manualBreaks || {},
        forcedDayBreaks: asSet(saved.forcedDayBreaks),
        forcedDayMerges: asSet(saved.forcedDayMerges),
        removedNightStays: asSet(saved.removedNightStays),
    };
}

const savedScheduleJson = (trip) => (trip ? stableJson(scheduleOf(stateFromTrip(trip))) : null);

/** Identifies a route by its stops, in order — the same stops reuse it. */
function routeSignature(places, trip) {
    const pt = (p) => (hasCoords(p) ? `${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}` : '-');
    return [pt(trip?.startingPoint), ...places.filter(p => p.lat).map(p => `${p.id}:${pt(p)}`), pt(trip?.endingPoint)].join('|');
}

function rememberRoute(sig, result) {
    routeCache.set(sig, result);
    if (routeCache.size > ROUTE_CACHE_LIMIT) routeCache.delete(routeCache.keys().next().value);
}

function ItineraryContent({ onOpenMap }) {
    const { selectedTrip, setSelectedTrip, places } = useTrip();
    const { user } = useAuth();
    const isGuest = useGuestMode();
    const navigate = useNavigate();
    const { tripId } = useParams();
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(() => sessionState.get(tripId)?.aiSuggestions || []);
    // Where this page starts: as it was left this session, else as saved on
    // the trip, else defaults (the trip itself may still be loading).
    const [initial] = useState(() => {
        const session = sessionState.get(tripId);
        if (session) return session;
        const trip = selectedTrip?.id === tripId ? selectedTrip : null;
        return {
            ...stateFromTrip(trip),
            aiDaysMeta: {},
            openLegs: new Set(),
            activeView: 'full',
            remoteJson: savedScheduleJson(trip),
            lastWrittenJson: null,
        };
    });
    const [activeView, setActiveView] = useState(initial.activeView); // 'full' | 0 | 1 | 2 ...
    const isMobile = useIsMobile();

    // Smart Timeline States
    const [dayStartTime, setDayStartTime] = useState(initial.dayStartTime);
    const [placeDurations, setPlaceDurations] = useState(initial.placeDurations); // placeId -> duration in minutes
    // Drive legs whose breaks are expanded; all are folded by default.
    const [openLegs, setOpenLegs] = useState(initial.openLegs);
    const toggleLeg = (key) => setOpenLegs(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });
    const [userOverrides, setUserOverrides] = useState(initial.userOverrides); // placeIds the user has manually edited
    const [aiDaysMeta, setAiDaysMeta] = useState(initial.aiDaysMeta); // placeId -> recommended days (from AI)
    const [loadingDurations, setLoadingDurations] = useState(false);
    const [cancelledBreaks, setCancelledBreaks] = useState(initial.cancelledBreaks);
    const [deletedBreaks, setDeletedBreaks] = useState(initial.deletedBreaks); // breakId -> true (permanently removed)
    const [manualBreaks, setManualBreaks] = useState(initial.manualBreaks); // transitIdx -> [{id, name, type, duration}]
    const [routeState, setRouteState] = useState(null); // { sig, result } — latest route fetched here
    const [forcedDayBreaks, setForcedDayBreaks] = useState(initial.forcedDayBreaks); // placeIds forced to next day
    const [forcedDayMerges, setForcedDayMerges] = useState(initial.forcedDayMerges); // placeIds where midnight split is suppressed
    const [removedNightStays, setRemovedNightStays] = useState(initial.removedNightStays); // placeIds where hotel night-stay is manually removed

    // ── Schedule sync with the trip ──────────────────────────────────────────
    // remoteJson: the saved schedule this page has caught up with.
    // lastWrittenJson: the last schedule this page saved itself.
    const [remoteJson, setRemoteJson] = useState(initial.remoteJson);
    const [lastWrittenJson, setLastWrittenJson] = useState(initial.lastWrittenJson);
    const tripReady = selectedTrip?.id === tripId;
    const currentRemoteJson = tripReady ? savedScheduleJson(selectedTrip) : null;
    if (tripReady && currentRemoteJson !== remoteJson) {
        // The saved schedule changed (first load, or another member edited
        // it). Adopt it — unless it's just our own save coming back.
        setRemoteJson(currentRemoteJson);
        if (currentRemoteJson !== lastWrittenJson) {
            const saved = stateFromTrip(selectedTrip);
            setDayStartTime(saved.dayStartTime);
            setUserOverrides(saved.userOverrides);
            // Keep AI estimates for everything the saved edits don't cover.
            setPlaceDurations(prev => {
                const next = {};
                Object.entries(prev).forEach(([id, mins]) => { if (!userOverrides[id]) next[id] = mins; });
                return { ...next, ...saved.placeDurations };
            });
            setCancelledBreaks(saved.cancelledBreaks);
            setDeletedBreaks(saved.deletedBreaks);
            setManualBreaks(saved.manualBreaks);
            setForcedDayBreaks(saved.forcedDayBreaks);
            setForcedDayMerges(saved.forcedDayMerges);
            setRemovedNightStays(saved.removedNightStays);
        }
    }

    const schedule = useMemo(
        () => scheduleOf({ dayStartTime, placeDurations, userOverrides, cancelledBreaks, deletedBreaks, manualBreaks, forcedDayBreaks, forcedDayMerges, removedNightStays }),
        [dayStartTime, placeDurations, userOverrides, cancelledBreaks, deletedBreaks, manualBreaks, forcedDayBreaks, forcedDayMerges, removedNightStays],
    );
    const scheduleJson = stableJson(schedule);

    // Save edits to the trip shortly after they're made. Only once the saved
    // schedule has been read (never overwrite it with defaults), and only
    // when something actually differs from it.
    const canSave = tripReady && !isGuest && remoteJson === currentRemoteJson;
    useEffect(() => {
        if (!canSave || scheduleJson === currentRemoteJson) return;
        const t = setTimeout(() => {
            setLastWrittenJson(scheduleJson);
            updateTrip(tripId, { schedule }).catch(e => console.error('Saving the schedule failed', e));
        }, 800);
        return () => clearTimeout(t);
        // schedule is captured with scheduleJson; it carries no other changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canSave, scheduleJson, currentRemoteJson, tripId]);

    const [sidebarTab, setSidebarTab] = useState(initial.sidebarTab || 'ai'); // 'ai' | 'onway' | 'nearby'
    const [sidebarMinimized, setSidebarMinimized] = useState(true);
    const [nearbyQuery, setNearbyQuery] = useState(initial.nearbyQuery || '');
    const [nearbyResults, setNearbyResults] = useState(initial.nearbyResults || []);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [onWayResults, setOnWayResults] = useState(initial.onWayResults || []);
    const [loadingOnWay, setLoadingOnWay] = useState(false);
    const [editingBreak, setEditingBreak] = useState(null); // { isNew, id, transitIdx, type, duration, afterDriveMinutes, maxTransitMinutes }

    // Remember the page for this session, so a tab switch restores it as is.
    useEffect(() => {
        sessionState.set(tripId, {
            dayStartTime, placeDurations, userOverrides, aiDaysMeta, cancelledBreaks, deletedBreaks,
            manualBreaks, forcedDayBreaks, forcedDayMerges, removedNightStays, openLegs, activeView,
            remoteJson, lastWrittenJson,
            aiSuggestions, sidebarTab, nearbyQuery, nearbyResults, onWayResults,
        });
    }, [tripId, dayStartTime, placeDurations, userOverrides, aiDaysMeta, cancelledBreaks, deletedBreaks,
        manualBreaks, forcedDayBreaks, forcedDayMerges, removedNightStays, openLegs, activeView, remoteJson, lastWrittenJson,
        aiSuggestions, sidebarTab, nearbyQuery, nearbyResults, onWayResults]);

    // ── Draft → profile claiming ─────────────────────────────────────────────
    // A trip is created anonymously as a draft. Claiming it to a profile is
    // what unlocks the collaborative tabs (Expenses, Chat, Polls).
    const isDraft = !!selectedTrip && !isTripClaimed(selectedTrip);
    const [claiming, setClaiming] = useState(false);
    const [claimError, setClaimError] = useState('');

    async function handleClaim() {
        if (!selectedTrip || claiming) return;
        // Saving to a profile needs an account — bounce to login, then resume
        // the claim automatically once the user lands back on this page.
        if (!user) {
            try { sessionStorage.setItem('trypinn_claim', selectedTrip.id); } catch { /* storage unavailable */ }
            navigate('/login', { state: { from: `/trip/${selectedTrip.id}/itinerary` } });
            return;
        }
        setClaiming(true);
        setClaimError('');
        try {
            await claimTrip(selectedTrip.id, user.uid);
            removeDraftId(selectedTrip.id);
            setSelectedTrip({ ...selectedTrip, claimed: true, createdBy: user.uid });
        } catch (e) {
            setClaimError(e.message || 'Could not save this trip. Please try again.');
        } finally {
            setClaiming(false);
        }
    }

    // Resume a pending claim after the user signs in (see handleClaim).
    useEffect(() => {
        if (!user || !selectedTrip) return;
        let pending = null;
        try { pending = sessionStorage.getItem('trypinn_claim'); } catch { /* storage unavailable */ }
        if (pending !== selectedTrip.id || isTripClaimed(selectedTrip)) return;
        try { sessionStorage.removeItem('trypinn_claim'); } catch { /* storage unavailable */ }
        (async () => {
            try {
                await claimTrip(selectedTrip.id, user.uid);
                removeDraftId(selectedTrip.id);
                setSelectedTrip({ ...selectedTrip, claimed: true, createdBy: user.uid });
            } catch (e) {
                console.error('Auto-claim failed', e);
            }
        })();
    }, [user, selectedTrip, setSelectedTrip]);
    // Sort places by saved order. Memoised so its identity is stable across
    // renders — effects can depend on it directly without signature hacks.
    const placeOrderKey = selectedTrip?.placeOrder?.join(',') ?? '';
    const placesKey = places.map(p => `${p.id}:${p.lat ?? ''}`).join(',');
    const orderedPlaces = useMemo(() => {
        const list = places.filter(p => p.lat);
        if (selectedTrip?.placeOrder) {
            list.sort((a, b) => {
                const indexA = selectedTrip.placeOrder.indexOf(a.id);
                const indexB = selectedTrip.placeOrder.indexOf(b.id);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        }
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placesKey, placeOrderKey]);

    // The trip the sidebar's results belong to. Restored results already
    // belong to this trip, so coming back to the tab doesn't wipe them.
    const sidebarTripRef = useRef(sessionState.has(tripId) ? tripId : null);
    useEffect(() => {
        // Clear suggestions left over from a different trip
        if (sidebarTripRef.current !== selectedTrip?.id) {
            setAiSuggestions([]);
            setOnWayResults([]);
            setNearbyResults([]);
            setNearbyQuery('');
        }
        sidebarTripRef.current = selectedTrip?.id;

        // Fetch AI suggestions for sidebar — cached by trip ID in localStorage
        let isMounted = true;
        async function fetchAI() {
            if (!selectedTrip?.id) return;

            // Check localStorage cache first
            const cacheKey = `ai_suggestions_${selectedTrip.id}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed?.length > 0) {
                        if (isMounted) setAiSuggestions(parsed);
                        return;
                    }
                } catch { /* invalid cache, re-fetch */ }
            }

            setLoadingAI(true);
            try {
                const promptContext = orderedPlaces.length > 0
                    ? `Route passing through: ${orderedPlaces.slice(0, 3).map(p => p.name).join(' -> ')}`
                    : selectedTrip?.destination || 'popular tourist places';
                const suggestions = await getSuggestions(promptContext);
                const allPlaces = [
                    ...(suggestions.places || []).map((p) => ({ ...p, category: 'historical' })),
                    ...(suggestions.food_places || []).map((p) => ({ ...p, category: 'food' })),
                ].slice(0, 4); // Take top 4

                // Enrich AI suggestions with Google images
                const enriched = await enrichPlacesWithGoogle(allPlaces, selectedTrip?.destination || '');
                if (isMounted) {
                    setAiSuggestions(enriched);
                    // Cache in localStorage
                    try { localStorage.setItem(cacheKey, JSON.stringify(enriched)); } catch { /* quota or storage unavailable */ }
                }
            } catch (e) {
                console.error("AI fetch failed:", e);
            } finally {
                if (isMounted) setLoadingAI(false);
            }
        }

        if (selectedTrip) {
            fetchAI();
        }

        return () => { isMounted = false; };
        // Intentionally keyed on trip id only — AI suggestions are cached per
        // trip; re-running on every orderedPlaces edit would waste API calls.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTrip?.id]);

    // Fetch AI-suggested visit durations whenever the place list changes
    useEffect(() => {
        let isMounted = true;
        const visitable = orderedPlaces.filter(p => !p.isStartingPoint && !p.isEndingPoint && p.lat);
        if (!visitable.length) return;

        // ⚠️  Exclude hotel/accommodation places — they have smart night-stay logic (840 min)
        // that must never be overridden by the AI duration estimate.
        const isHotel = (p) =>
            p.name.toLowerCase().includes('hotel') ||
            p.category?.toLowerCase() === 'accommodation' ||
            p.category?.toLowerCase() === 'hotel' ||
            p.name.toLowerCase().includes('resort') ||
            p.name.toLowerCase().includes('lodge') ||
            p.name.toLowerCase().includes('hostel') ||
            p.name.toLowerCase().includes('inn');

        // Only query non-hotel places that don't yet have a user override
        const placesToQuery = visitable.filter(p => !userOverrides[p.id] && !isHotel(p));
        if (!placesToQuery.length) return;

        async function fetchDurations() {
            try {
                const cacheKey = `ai_durations_v2_${placesToQuery.map(p => p.id).join('-')}`;
                let result = null;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try { result = JSON.parse(cached); } catch { /* invalid JSON, ignore */ }
                }
                if (!result) {
                    // Only a real request shows "AI timing…" — a cache hit
                    // would just flash it.
                    setLoadingDurations(true);
                    result = await getPlaceVisitDurations(placesToQuery);
                    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* quota or storage unavailable */ }
                }
                if (isMounted) {
                    // result = { durations: { [id]: mins }, daysMeta: { [id]: days } }
                    setPlaceDurations(prev => {
                        const updated = { ...prev };
                        Object.entries(result.durations || result).forEach(([id, mins]) => {
                            if (!userOverrides[id]) updated[id] = mins;
                        });
                        return updated;
                    });
                    if (result.daysMeta) {
                        setAiDaysMeta(prev => ({ ...prev, ...result.daysMeta }));
                    }
                }
            } catch (e) {
                console.error('AI duration fetch failed:', e);
            } finally {
                if (isMounted) setLoadingDurations(false);
            }
        }

        fetchDurations();
        return () => { isMounted = false; };
        // Re-run only when the set of places changes — userOverrides is read
        // as a live filter and must not retrigger fetches on its own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderedPlaces]);

    // Add a sidebar suggestion directly to the trip's Firestore place list
    const addToItinerary = async (place) => {
        if (!tripId) return;
        try {
            const toSave = [{
                name: place.name,
                description: place.description || '',
                category: place.category || 'place',
                lat: place.lat || null,
                lng: place.lng || null,
                imageUrl: place.imageUrl || null,
                estimatedMinutes: place.estimatedMinutes || 60,
            }];
            const ids = await addPlaces(tripId, toSave);
            const newOrder = [...(selectedTrip?.placeOrder || orderedPlaces.map(p => p.id)), ...ids];
            await updatePlaceOrder(tripId, newOrder);
        } catch (e) { console.error('Failed to add place to itinerary', e); }
    };

    // ── Reordering: drag a stop by its handle, or nudge it with ▲ / ▼ ────────
    // Cards glide to their new places (FLIP): note where every card is just
    // before the order changes, then animate each from there once it moves.
    const flipFrom = useRef(null);
    const captureCardPositions = () => {
        flipFrom.current = new Map(
            [...document.querySelectorAll('[data-stop-id]')].map(el => [el.dataset.stopId, el.getBoundingClientRect().top]),
        );
    };
    useLayoutEffect(() => {
        const from = flipFrom.current;
        flipFrom.current = null;
        if (!from || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        document.querySelectorAll('[data-stop-id]').forEach(el => {
            const before = from.get(el.dataset.stopId);
            if (before == null) return;
            const delta = before - el.getBoundingClientRect().top;
            if (Math.abs(delta) < 1) return;
            el.style.transition = 'none';
            el.style.transform = `translateY(${delta}px)`;
            requestAnimationFrame(() => {
                el.style.transition = 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)';
                el.style.transform = '';
            });
        });
    }, [placeOrderKey]);

    const reorderPlace = async (fromIndex, toIndex) => {
        if (fromIndex < 0 || toIndex < 0 || toIndex >= orderedPlaces.length || fromIndex === toIndex) return;
        const newPlaces = [...orderedPlaces];
        const [moved] = newPlaces.splice(fromIndex, 1);
        newPlaces.splice(toIndex, 0, moved);
        const newOrder = newPlaces.map(p => p.id);
        captureCardPositions();

        // Optimistic UI update for immediate visual feedback
        setSelectedTrip(prev => ({
            ...prev,
            placeOrder: newOrder,
            routeConfig: { ...prev.routeConfig, optimize: false }
        }));

        await updatePlaceOrder(selectedTrip.id, newOrder, newPlaces);
        await updateRouteConfig(selectedTrip.id, { optimize: false });
    };

    const handleMovePlace = (index, direction) => reorderPlace(index, index + direction);

    // Drag: a floating copy of the card follows the pointer (mouse or touch),
    // a line marks where it will land, and the list scrolls near its edges.
    // All of it is plain DOM work outside React, so dragging stays smooth.
    const [draggingId, setDraggingId] = useState(null);
    const startDrag = (e, place) => {
        if (e.button > 0 || e.target.closest('button')) return; // the ▲ / ▼ still click
        const card = e.currentTarget.closest('[data-stop-id]');
        const scroller = document.querySelector('.itinerary-main');
        const fromIndex = orderedPlaces.findIndex(p => p.id === place.id);
        if (!card || fromIndex === -1) return;
        e.preventDefault();

        const rect = card.getBoundingClientRect();
        const grabOffset = e.clientY - rect.top;
        const ghost = card.cloneNode(true);
        ghost.removeAttribute('data-stop-id');
        Object.assign(ghost.style, {
            position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
            margin: 0, zIndex: 3000, pointerEvents: 'none', transition: 'none',
            transform: 'scale(1.02)', boxShadow: '0 24px 48px rgba(15,23,42,0.22)', opacity: '0.96',
        });
        const line = document.createElement('div');
        line.className = 'itin-drop-line';
        document.body.append(ghost, line);
        document.body.classList.add('is-dragging-stop');
        setDraggingId(place.id);

        let toIndex = fromIndex;
        let lastY = e.clientY;
        let scrollSpeed = 0;

        const locate = (y) => {
            // Other visible cards, in trip order. In a single-day view only
            // that day's stops are on screen.
            const others = [...document.querySelectorAll('[data-stop-id]')]
                .filter(el => el.dataset.stopId !== place.id)
                .map(el => ({ el, rect: el.getBoundingClientRect(), index: orderedPlaces.findIndex(p => p.id === el.dataset.stopId) }))
                .filter(o => o.index !== -1)
                .sort((a, b) => a.index - b.index);
            if (!others.length) return;
            const below = others.find(o => y < o.rect.top + o.rect.height / 2);
            const without = (i) => (i > fromIndex ? i - 1 : i);
            const anchor = below || others[others.length - 1];
            toIndex = below ? without(below.index) : without(anchor.index) + 1;
            const lineY = below ? below.rect.top - 9 : anchor.rect.bottom + 1;
            Object.assign(line.style, { top: `${lineY}px`, left: `${anchor.rect.left}px`, width: `${anchor.rect.width}px` });
            line.classList.toggle('is-noop', toIndex === fromIndex);
        };

        const move = (ev) => {
            lastY = ev.clientY;
            ghost.style.top = `${ev.clientY - grabOffset}px`;
            locate(ev.clientY);
            const box = scroller?.getBoundingClientRect();
            if (!box) return;
            const edge = 90;
            scrollSpeed = ev.clientY < box.top + edge ? -Math.ceil((box.top + edge - ev.clientY) / 6)
                : ev.clientY > box.bottom - edge ? Math.ceil((ev.clientY - (box.bottom - edge)) / 6) : 0;
        };
        const tick = setInterval(() => {
            if (!scrollSpeed || !scroller) return;
            scroller.scrollTop += scrollSpeed;
            locate(lastY);
        }, 16);

        const finish = (commit) => {
            clearInterval(tick);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('keydown', onKey);
            ghost.remove();
            line.remove();
            document.body.classList.remove('is-dragging-stop');
            setDraggingId(null);
            if (commit && toIndex !== fromIndex) reorderPlace(fromIndex, toIndex);
        };
        const onUp = () => finish(true);
        const onCancel = () => finish(false);
        const onKey = (ev) => { if (ev.key === 'Escape') finish(false); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        window.addEventListener('keydown', onKey);
        locate(e.clientY);
    };

    const formatDuration = (totalMinutes) => {
        if (totalMinutes < 60) return `${totalMinutes} mins`;
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return mins > 0 ? `${hrs} hr ${mins} mins` : `${hrs} hr`;
    };

    const routesLibrary = useMapsLibrary('routes');

    // Route for the current sequence (no optimization). Cached by its stops,
    // so returning to this tab — or the trip doc updating for any other
    // reason — reuses it instead of fetching and redrawing the schedule.
    const routeSig = routeSignature(places, selectedTrip);
    const itineraryRoute = (routeState?.sig === routeSig ? routeState.result : routeCache.get(routeSig)) || routeState?.result || null;
    useEffect(() => {
        let isMounted = true;
        const sig = routeSig;
        if (routeCache.has(sig)) return;
        const fetchRoute = async () => {
            if (!routesLibrary || !places || places.length === 0) return;
            const validPlaces = places.filter(p => p.lat);

            const sortedValid = [...validPlaces];
            if (selectedTrip?.placeOrder) {
                sortedValid.sort((a, b) => {
                    const idxA = selectedTrip.placeOrder.indexOf(a.id);
                    const idxB = selectedTrip.placeOrder.indexOf(b.id);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return 0;
                });
            }

            try {
                // optimize = false ensures we get transit times for the EXACT sequence user arranged
                const res = await getOptimizedRoute(sortedValid, selectedTrip?.startingPoint || null, false, selectedTrip?.endingPoint || null);
                if (res) {
                    rememberRoute(sig, res.directionsResult);
                    if (isMounted) setRouteState({ sig, result: res.directionsResult });
                }
            } catch (e) {
                console.error('Failed to fetch route for itinerary, falling back to RouteMatrix', e);
                const placesToMap = [];
                if (hasCoords(selectedTrip?.startingPoint)) placesToMap.push(selectedTrip.startingPoint);
                placesToMap.push(...sortedValid);
                if (hasCoords(selectedTrip?.endingPoint)) placesToMap.push(selectedTrip.endingPoint);

                if (placesToMap.length >= 2) {
                    const metrics = await computeLegDurations(placesToMap);
                    if (metrics.length) {
                        const legs = metrics.map((m) => ({
                            duration: { value: m.duration || 0 },
                            distance: {
                                text: m.ok && m.distanceMeters != null
                                    ? `${(m.distanceMeters / 1000).toFixed(1)} km`
                                    : 'Unroutable',
                            },
                        }));
                        const result = { routes: [{ legs }] };
                        rememberRoute(sig, result);
                        if (isMounted) setRouteState({ sig, result });
                    }
                }
            }
        };

        fetchRoute();
        return () => { isMounted = false; };
        // routeSig captures every input that changes the route.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeSig, routesLibrary]);

    // Calculate intelligent timeline
    const timeline = useMemo(() => {
        let currentTime = new Date();
        const [hours, minutes] = dayStartTime.split(':').map(Number);
        currentTime.setHours(hours, minutes, 0, 0);

        const placesToMap = [];
        // Only geocoded endpoints can be placed on the map / timed in a route.
        if (hasCoords(selectedTrip?.startingPoint)) {
            placesToMap.push({ ...selectedTrip.startingPoint, id: 'start-point', isStartingPoint: true, name: selectedTrip.startingPoint.name || 'Starting Point' });
        }
        placesToMap.push(...orderedPlaces);
        if (hasCoords(selectedTrip?.endingPoint)) {
            placesToMap.push({ ...selectedTrip.endingPoint, id: 'end-point', isEndingPoint: true, name: selectedTrip.endingPoint.name || 'Ending Point' });
        }

        return placesToMap.map((place, idx) => {
            const isHotelType = place.name.toLowerCase().includes('hotel') || place.category?.toLowerCase() === 'accommodation' || place.category?.toLowerCase() === 'hotel' || place.name.toLowerCase().includes('resort') || place.name.toLowerCase().includes('hostel') || place.name.toLowerCase().includes('inn') || place.name.toLowerCase().includes('lodge');

            // Daytime-only categories — not suitable after 10 PM
            const DAYTIME_ONLY = ['temple', 'museum', 'nature', 'viewpoint', 'beach', 'heritage', 'market', 'park', 'garden', 'historical', 'wildlife'];
            const isDaytimeOnly = !isHotelType && DAYTIME_ONLY.some(c =>
                place.category?.toLowerCase().includes(c) ||
                place.name.toLowerCase().includes(c)
            );

            // Force next-day: smart advance to 08:00 AM
            if (forcedDayBreaks.has(place.id)) {
                if (currentTime.getHours() < 8) {
                    currentTime.setHours(8, 0, 0, 0);
                } else {
                    currentTime.setDate(currentTime.getDate() + 1);
                    currentTime.setHours(8, 0, 0, 0);
                }
            }

            // "Pull to Day" merge: if this place crossed midnight and user merged it into prev day,
            // reset back to 8 AM of the SAME calendar day (current day, before midnight).
            if (forcedDayMerges.has(place.id)) {
                // Only reset if we've crossed midnight (i.e. it's very early morning)
                if (currentTime.getHours() < 8) {
                    currentTime.setHours(8, 0, 0, 0);
                }
            }

            const arrivalTime = new Date(currentTime);
            const arrivalHour = arrivalTime.getHours();

            // Flag if a daytime place is visited after 10 PM or before 5 AM
            const isAfterHours = isDaytimeOnly && (arrivalHour >= 22 || arrivalHour < 5);

            // Smart Hotel Logic: If arriving after 4 PM, it's a night stay. If arriving earlier, it's just a check-in/lunch stop.
            // Allow user to manually remove night-stay classification via removedNightStays.
            const isNightStay = isHotelType && arrivalHour >= 16 && !removedNightStays.has(place.id);
            const isCheckInStop = isHotelType && (arrivalHour < 16 || removedNightStays.has(place.id));

            // User defined duration, or smart defaults
            const isStartOrEnd = place.isStartingPoint || place.isEndingPoint;
            const defaultDuration = isNightStay ? 840 : (isCheckInStop ? 60 : (isStartOrEnd ? 0 : 120));

            let durationMinutes = placeDurations[place.id] !== undefined
                ? placeDurations[place.id]
                : (place.estimatedMinutes !== undefined ? place.estimatedMinutes : defaultDuration);

            // Force night stay to 840 unless the user explicitly edited the duration THIS session
            if (isNightStay && !userOverrides[place.id]) {
                durationMinutes = 840;
            }

            const arrivalDateNum = arrivalTime.getDate();
            currentTime.setMinutes(currentTime.getMinutes() + durationMinutes);
            // Check if this stop's duration caused us to cross midnight into the next calendar day
            const isSpansMidnight = !isNightStay && currentTime.getDate() !== arrivalDateNum;

            const startHour = arrivalTime.getHours();
            const endHour = currentTime.getHours();

            let addedMealTime = 0;
            let potentialPlaceMeal = 0;
            const placeMealBreakId = `place-meal-${place.id}`;
            const placeMealCancelled = !!cancelledBreaks[placeMealBreakId];

            // Add lunch break if crossing 1 PM - 2 PM
            if (startHour <= 13 && endHour >= 13 && !isStartOrEnd && durationMinutes > 30) potentialPlaceMeal = 60;
            // Add dinner break if crossing 8 PM - 9 PM
            else if (startHour <= 20 && endHour >= 20 && !isStartOrEnd && durationMinutes > 30) potentialPlaceMeal = 60;

            if (potentialPlaceMeal > 0) {
                const finalPlaceMeal = placeDurations[placeMealBreakId] !== undefined ? placeDurations[placeMealBreakId] : potentialPlaceMeal;
                potentialPlaceMeal = finalPlaceMeal;
                if (!placeMealCancelled) addedMealTime = potentialPlaceMeal;
            }

            currentTime.setMinutes(currentTime.getMinutes() + addedMealTime);

            const departureTime = new Date(currentTime);

            let transitMinutes = 0;
            let transitDistance = "";
            let transitEvents = [];

            // Check if we have route data for transit to NEXT place
            if (itineraryRoute?.routes?.[0]?.legs?.[idx]) {
                const leg = itineraryRoute.routes[0].legs[idx];
                const transitSeconds = leg.duration.value;
                transitMinutes = Math.ceil(transitSeconds / 60);
                transitDistance = leg.distance?.text || "";

                // Smart transit buffers
                if (transitMinutes > 30) transitMinutes += 5;
                if (transitMinutes > 120) transitMinutes += 15;

                const rawTransitMinutes = transitMinutes;
                const driveStart = new Date(departureTime);

                // Identify when during the drive we'd hit meal times & rest intervals
                const suggestedBreaks = [];

                // Tea breaks: one every 3 hours of driving, never at the moment
                // of arrival (a 6-hour drive gets one, at the 3-hour mark).
                const numRests = Math.max(0, Math.ceil(rawTransitMinutes / 180) - 1);
                for (let i = 0; i < numRests; i++) {
                    const restAt = new Date(driveStart);
                    restAt.setMinutes(restAt.getMinutes() + (i + 1) * 180);
                    suggestedBreaks.push({ id: `transit-${idx}-rest-${i}`, name: 'Rest Stop', type: 'rest', defaultDuration: 15, scheduledAt: restAt });
                }

                // Meal breaks at breakfast, lunch and dinner time on every day the
                // drive spans — a 14-hour overnight drive gets dinner and the next
                // morning's breakfast. The first day keeps its original ids so
                // edits saved against them still apply.
                if (rawTransitMinutes >= 60) {
                    const driveEnd = new Date(driveStart);
                    driveEnd.setMinutes(driveEnd.getMinutes() + rawTransitMinutes);
                    const MEALS = [
                        ['breakfast', 'Breakfast Stop', 8, 30],
                        ['lunch', 'Lunch Stop', 13, 60],
                        ['dinner', 'Dinner Stop', 20, 60],
                    ];
                    for (let d = 0; d < 7; d++) {
                        const day = new Date(driveStart);
                        day.setDate(day.getDate() + d);
                        day.setHours(0, 0, 0, 0);
                        if (day > driveEnd) break;
                        for (const [key, name, hour, minutes] of MEALS) {
                            const at = new Date(day);
                            at.setHours(hour, 0, 0, 0);
                            if (at > driveStart && at < driveEnd) {
                                suggestedBreaks.push({ id: `transit-${idx}-${key}${d ? `-d${d}` : ''}`, name, type: 'meal', defaultDuration: minutes, scheduledAt: at });
                            }
                        }
                    }
                }

                // Sort breaks by scheduled time within the drive
                suggestedBreaks.sort((a, b) => a.scheduledAt - b.scheduledAt);

                // Append manual breaks (placed based on afterDriveMinutes or end of drive)
                const manualForLeg = (manualBreaks[idx] || []);
                const allBreaks = [
                    ...suggestedBreaks,
                    ...manualForLeg.map(b => ({
                        ...b,
                        scheduledAt: new Date(driveStart.getTime() + (b.afterDriveMinutes !== undefined ? b.afterDriveMinutes : rawTransitMinutes) * 60000)
                    }))
                ];

                // Calculate break arrival times: scheduled position + preceding break durations
                let totalBreakTime = 0;
                for (const brk of allBreaks) {
                    if (deletedBreaks[brk.id]) continue;
                    const isCancelled = !!cancelledBreaks[brk.id];
                    let finalDuration = placeDurations[brk.id] !== undefined ? placeDurations[brk.id] : brk.defaultDuration;

                    const eventArrival = new Date(brk.scheduledAt);
                    eventArrival.setMinutes(eventArrival.getMinutes() + totalBreakTime);

                    if (brk.type === 'night_stay' && !isCancelled && placeDurations[brk.id] === undefined) {
                        const nextMorning = new Date(eventArrival);
                        if (nextMorning.getHours() < 8) {
                            nextMorning.setHours(8, 0, 0, 0);
                        } else {
                            nextMorning.setDate(nextMorning.getDate() + 1);
                            nextMorning.setHours(8, 0, 0, 0);
                        }
                        finalDuration = Math.round((nextMorning - eventArrival) / 60000);
                        if (finalDuration < 0) finalDuration = 480; // fallback
                    }

                    const eventDeparture = new Date(eventArrival);
                    if (!isCancelled) {
                        eventDeparture.setMinutes(eventDeparture.getMinutes() + finalDuration);
                        totalBreakTime += finalDuration;
                    }

                    transitEvents.push({
                        id: brk.id,
                        name: brk.name,
                        type: brk.type,
                        duration: finalDuration,
                        arrivalTime: eventArrival,
                        departureTime: eventDeparture,
                        isCancelled,
                        isManual: !!brk.isManual,
                        afterDriveMinutes: brk.afterDriveMinutes !== undefined ? brk.afterDriveMinutes : Math.max(0, Math.round((brk.scheduledAt - driveStart) / 60000)),
                        maxTransitMinutes: rawTransitMinutes
                    });
                }

                // Sort by arrival time again to ensure correct display order after dynamic duration calculations
                transitEvents.sort((a, b) => a.arrivalTime - b.arrivalTime);

                // Advance currentTime by drive + all active breaks
                currentTime = new Date(driveStart);
                currentTime.setMinutes(currentTime.getMinutes() + rawTransitMinutes + totalBreakTime);
            }

            return {
                place,
                arrivalTime,
                departureTime,
                durationMinutes,
                transitMinutes,
                transitDistance,
                isNightStay,
                isCheckInStop,
                isAfterHours,
                isSpansMidnight,
                addedMealTime,
                potentialPlaceMeal,
                placeMealBreakId,
                placeMealCancelled,
                transitEvents
            };
        });
    }, [orderedPlaces, dayStartTime, placeDurations, itineraryRoute, cancelledBreaks, deletedBreaks, manualBreaks, forcedDayBreaks, forcedDayMerges, removedNightStays, userOverrides, selectedTrip?.startingPoint, selectedTrip?.endingPoint]);

    const handleDurationChange = (placeId, minutes) => {
        setUserOverrides(prev => ({ ...prev, [placeId]: true }));
        setPlaceDurations(prev => ({ ...prev, [placeId]: minutes }));
        if (!placeId.startsWith('transit-') && !placeId.startsWith('place-meal-') && !placeId.startsWith('manual-') && !placeId.startsWith('start-point') && !placeId.startsWith('end-point')) {
            updatePlaceDuration(placeId, minutes).catch(console.error);
        }
    };

    const toggleBreak = (breakId) => {
        setCancelledBreaks(prev => ({ ...prev, [breakId]: !prev[breakId] }));
    };

    const deleteBreak = (breakId) => {
        setDeletedBreaks(prev => ({ ...prev, [breakId]: true }));
        // Also clear cancel state if any
        setCancelledBreaks(prev => { const n = { ...prev }; delete n[breakId]; return n; });
    };

    const addManualBreak = (transitIdx, type) => {
        setEditingBreak({
            isNew: true,
            id: null,
            transitIdx,
            type,
            name: type === 'night_stay' ? 'Night Stay' : type === 'meal' ? 'Meal Break' : 'Rest Stop',
            duration: type === 'night_stay' ? 480 : type === 'meal' ? 60 : 15,
            afterDriveMinutes: 0,
        });
    };

    const handleSaveBreak = () => {
        if (!editingBreak) return;
        const { id, isNew, transitIdx, type, name, duration, afterDriveMinutes } = editingBreak;

        if (isNew) {
            const newBreak = {
                id: `manual-${transitIdx}-${Date.now()}`,
                name,
                type,
                defaultDuration: duration,
                afterDriveMinutes,
                isManual: true
            };
            setManualBreaks(prev => ({
                ...prev,
                [transitIdx]: [...(prev[transitIdx] || []), newBreak]
            }));
        } else {
            if (id.startsWith('manual-')) {
                setManualBreaks(prev => ({
                    ...prev,
                    [transitIdx]: (prev[transitIdx] || []).map(b => b.id === id ? { ...b, type, name, defaultDuration: duration, afterDriveMinutes } : b)
                }));
                setPlaceDurations(prev => {
                    if (prev[id] !== undefined) return { ...prev, [id]: duration };
                    return prev;
                });
            } else {
                setDeletedBreaks(prev => ({ ...prev, [id]: true }));
                const newBreak = {
                    id: `manual-${transitIdx}-${Date.now()}`,
                    name,
                    type,
                    defaultDuration: duration,
                    afterDriveMinutes,
                    isManual: true
                };
                setManualBreaks(prev => ({
                    ...prev,
                    [transitIdx]: [...(prev[transitIdx] || []), newBreak]
                }));
            }
        }
        setEditingBreak(null);
    };

    // Split full timeline into per-day groups based on night stays, isSpansMidnight, AND midnight crossings
    const dayGroups = useMemo(() => {
        if (!timeline.length) return [];
        const groups = [];
        let current = [];
        let currentDateNum = timeline[0]?.arrivalTime?.getDate();
        timeline.forEach((item) => {
            const itemDate = item.arrivalTime?.getDate();
            // Midnight crossing split — suppressed if user has merged this place to previous day
            const crossedMidnight = currentDateNum !== undefined
                && itemDate !== currentDateNum
                && !item.isCarryOver
                && !forcedDayMerges.has(item.place.id);
            if (crossedMidnight) {
                if (current.length) groups.push(current);
                current = [item];
                currentDateNum = itemDate;
            } else {
                current.push(item);
                // Split day after a night stay OR after a stop that spans midnight (e.g. 960 min)
                if (item.isNightStay || item.isSpansMidnight) {
                    groups.push(current);
                    current = [];
                    const nextDay = new Date(item.departureTime || item.arrivalTime);
                    currentDateNum = nextDay.getDate();
                }
            }
        });
        if (current.length) groups.push(current);
        return groups;
    }, [timeline, forcedDayMerges]);

    const visibleTimeline = useMemo(() => {
        if (activeView === 'full') {
            const full = [];
            for (let i = 0; i < dayGroups.length; i++) {
                let hasCarryOver = false;
                if (i > 0) {
                    const prevDayItems = dayGroups[i - 1] || [];
                    const prevNightStay = prevDayItems[prevDayItems.length - 1];
                    if (prevNightStay?.isNightStay || prevNightStay?.isSpansMidnight) {
                        full.push({ ...prevNightStay, isCarryOver: true, dayBoundaryDayIndex: i });
                        hasCarryOver = true;
                    }
                }
                dayGroups[i].forEach((item, innerIdx) => {
                    full.push({
                        ...item,
                        dayBoundaryDayIndex: (i > 0 && innerIdx === 0 && !hasCarryOver) ? i : -1
                    });
                });
            }
            return full;
        }

        const dayItems = dayGroups[activeView] || [];
        if (activeView === 0) return dayItems.map(item => ({ ...item, dayBoundaryDayIndex: -1 }));
        
        const prevDayItems = dayGroups[activeView - 1] || [];
        const prevNightStay = prevDayItems[prevDayItems.length - 1];
        if (prevNightStay?.isNightStay || prevNightStay?.isSpansMidnight) {
            return [
                { ...prevNightStay, isCarryOver: true, dayBoundaryDayIndex: activeView }, 
                ...dayItems.map(item => ({ ...item, dayBoundaryDayIndex: -1 }))
            ];
        }
        return dayItems.map((item, idx) => ({
            ...item, 
            dayBoundaryDayIndex: idx === 0 ? activeView : -1
        }));
    }, [activeView, timeline, dayGroups]);

    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatTabDate = (d) => d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} · ${WEEKDAYS[d.getDay()]}` : '';

    return (
        <div className="itinerary-page" style={{ flexDirection: isMobile ? 'column' : 'row', overflowX: 'hidden' }}>
            {/* Left Main Area */}
            <div className="itinerary-main" style={{ padding: isMobile ? '20px 16px' : '36px 44px', overflowX: 'hidden' }}>
                {isDraft && (
                    <div className="claim-banner">
                        <div className="claim-banner-text">
                            <div className="claim-banner-title">
                                <Sparkles size={16} aria-hidden="true" /> This trip is a draft
                            </div>
                            <p>Save it to your profile to unlock group expenses, chat and polls — and keep it synced across your devices.</p>
                            {claimError && <p className="claim-banner-error">{claimError}</p>}
                        </div>
                        <button type="button" className="claim-banner-btn" onClick={handleClaim} disabled={claiming}>
                            {claiming
                                ? <div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} aria-hidden="true" />
                                : <><BookmarkPlus size={16} aria-hidden="true" /> Add to my profile</>}
                        </button>
                    </div>
                )}
                <div className="trip-head">
                    <div className="trip-head-text">
                        <span className="eyebrow" style={{ color: 'var(--color-teal)' }}>Day by day</span>
                        <h1 className="trip-head-title">Your itinerary.</h1>
                        <p className="trip-head-sub">Smart scheduling with intelligent breaks, driving times, and automatic day splits.</p>
                    </div>
                    {onOpenMap && (
                        <button type="button" className="trip-map-btn" onClick={onOpenMap} aria-label="Open map view">
                            <MapIcon size={16} aria-hidden="true" /> Map
                        </button>
                    )}
                </div>

                {/* View Tabs */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 28, overflowX: 'auto', paddingBottom: 6, flexWrap: 'nowrap' }} role="tablist">
                    <button
                        type="button"
                        onClick={() => setActiveView('full')}
                        role="tab"
                        aria-selected={activeView === 'full'}
                        style={{
                            background: activeView === 'full' ? 'linear-gradient(135deg, #0b1220, #1e293b)' : 'rgba(255,255,255,0.85)',
                            color: activeView === 'full' ? '#fff' : 'var(--text-secondary)',
                            border: activeView === 'full' ? '1px solid transparent' : '1px solid var(--border-subtle)',
                            padding: isMobile ? '10px 16px' : '12px 22px', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                            boxShadow: activeView === 'full' ? '0 8px 20px rgba(11,18,32,0.22)' : 'var(--shadow-xs)',
                            minWidth: isMobile ? 96 : 120, fontFamily: 'inherit',
                            backdropFilter: activeView === 'full' ? 'none' : 'blur(12px)',
                            WebkitBackdropFilter: activeView === 'full' ? 'none' : 'blur(12px)',
                        }}
                    >
                        <span style={{ fontSize: 14, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.2px' }}>🗺️ Full Trip</span>
                        <span style={{ fontSize: 11, opacity: 0.82, fontWeight: 600 }}>{timeline.length} stops</span>
                    </button>

                    {dayGroups.map((group, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setActiveView(i)}
                            role="tab"
                            aria-selected={activeView === i}
                            style={{
                                background: activeView === i ? 'linear-gradient(135deg, var(--color-indigo), var(--color-violet))' : 'rgba(255,255,255,0.85)',
                                color: activeView === i ? '#fff' : 'var(--text-secondary)',
                                border: activeView === i ? '1px solid transparent' : '1px solid var(--border-subtle)',
                                padding: isMobile ? '10px 16px' : '12px 22px', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                                boxShadow: activeView === i ? '0 8px 20px rgba(91,92,246,0.32)' : 'var(--shadow-xs)',
                                minWidth: isMobile ? 96 : 120, fontFamily: 'inherit',
                                backdropFilter: activeView === i ? 'none' : 'blur(12px)',
                                WebkitBackdropFilter: activeView === i ? 'none' : 'blur(12px)',
                            }}
                        >
                            <span style={{ fontSize: 14, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.2px' }}>Day {i + 1}</span>
                            <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>{formatTabDate(group[0]?.arrivalTime)}</span>
                        </button>
                    ))}
                </div>

                {/* Itinerary List */}
                <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 8 }}>
                    {/* Start Time Header Node */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                            ▶
                        </div>
                        <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.8)', padding: isMobile ? '10px 16px' : '12px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 8px 32px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.6)', flex: 1, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
                            <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: '#0f172a' }}>Day Starts At:</span>
                            <input
                                type="time"
                                value={dayStartTime}
                                onChange={(e) => setDayStartTime(e.target.value)}
                                style={{ padding: isMobile ? '8px 10px' : '6px 12px', borderRadius: 8, border: '1px solid #94a3b8', fontSize: isMobile ? 16 : 15, fontWeight: 600, outline: 'none', color: '#0f172a', background: '#f8fafc' }}
                            />
                        </div>
                    </div>
                    {/* Prompt to add places in Plan tab */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: '12px 16px', background: 'rgba(91,92,246,0.06)', borderRadius: 14, border: '1px solid rgba(91,92,246,0.18)' }}>
                        <MapPin size={16} color="var(--color-indigo)" aria-hidden="true" />
                        <span style={{ fontSize: 13, color: 'var(--color-indigo-deep)', fontWeight: 600, flex: 1 }}>
                            Want to add or reorder stops? Use the Plan tab.
                        </span>
                        <button type="button" onClick={() => navigate(`/trip/${tripId}`)} className="btn btn-accent btn-sm">
                            Open Plan <ArrowRight size={12} aria-hidden="true" />
                        </button>
                    </div>

                    {visibleTimeline.length === 0 ? (
                        <div className="glass-card-static" style={{ textAlign: 'center', padding: 56, border: '2px dashed rgba(91,92,246,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                            <div style={{ fontSize: 56, animation: 'floatSoft 4s ease-in-out infinite', filter: 'drop-shadow(0 6px 16px rgba(91,92,246,0.18))' }} aria-hidden="true">📍</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>No itinerary yet</div>
                            <div style={{ fontSize: 14.5, color: 'var(--text-tertiary)', maxWidth: 380, lineHeight: 1.55 }}>Head to the Plan tab to add stops — we'll automatically schedule them across days with smart drive times.</div>
                            <button type="button" onClick={() => navigate(`/trip/${tripId}`)} className="btn btn-accent btn-md">
                                Go to Plan <ArrowRight size={16} aria-hidden="true" />
                            </button>
                        </div>
                    ) : (
                        visibleTimeline.map((item, visibleIdx) => {
                            const { place, arrivalTime, departureTime, durationMinutes,
                                transitMinutes, transitDistance, isNightStay, isCheckInStop, isAfterHours,
                                isSpansMidnight,
                                potentialPlaceMeal, placeMealBreakId, placeMealCancelled,
                                transitEvents } = item;
                            const idx = timeline.indexOf(item); // real global index for break IDs
                            const isCarryOver = !!item.isCarryOver; // night-stay from prev day shown as starting point
                            const dayBoundaryDayIndex = item.dayBoundaryDayIndex !== undefined ? item.dayBoundaryDayIndex : -1;

                            return (
                                <Fragment key={`${place.id}-${isCarryOver ? 'carry' : 'main'}`}>
                                    {/* Day boundary banner — shown before first item of Day 2+ */}
                                    {dayBoundaryDayIndex > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 48, marginBottom: 10, marginTop: 4 }}>
                                            <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #1E3A8A, #e2e8f0)', borderRadius: 2 }} />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EEF3FC', border: '1px solid #BFD0F0', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#1E3A8A', whiteSpace: 'nowrap' }}>
                                                📅 Day {dayBoundaryDayIndex + 1} starts here
                                                {/* Pull/Push controls — hidden for guests */}
                                                {!isGuest && forcedDayMerges.has(place.id) ? (
                                                    <button type="button"
                                                        onClick={() => setForcedDayMerges(prev => { const n = new Set(prev); n.delete(place.id); return n; })}
                                                        title="Undo merge"
                                                        style={{ background: '#fff', border: '1px solid #BFD0F0', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, color: '#1E3A8A', cursor: 'pointer' }}
                                                    >↩ Undo</button>
                                                ) : !isGuest ? (
                                                    <button type="button"
                                                        onClick={() => {
                                                            if (forcedDayBreaks.has(place.id)) {
                                                                setForcedDayBreaks(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                                                            } else {
                                                                setForcedDayMerges(prev => new Set([...prev, place.id]));
                                                            }
                                                        }}
                                                        title={`Pull into Day ${dayBoundaryDayIndex}`}
                                                        style={{ background: '#1E3A8A', border: 'none', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                                                    >← Pull to Day {dayBoundaryDayIndex}</button>
                                                ) : null}
                                                {!isGuest && forcedDayBreaks.has(place.id) ? (
                                                    <button type="button"
                                                        onClick={() => setForcedDayBreaks(prev => { const n = new Set(prev); n.delete(place.id); return n; })}
                                                        title="Undo push"
                                                        style={{ background: '#fff', border: '1px solid #BFD0F0', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, color: '#1E3A8A', cursor: 'pointer' }}
                                                    >↩ Undo push</button>
                                                ) : null}
                                            </div>
                                            <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #e2e8f0, transparent)', borderRadius: 2 }} />
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', position: 'relative' }}>
                                        {/* Timeline Node & Line */}
                                        <div style={{ width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 16 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                background: isCarryOver ? '#172E6E' : '#3b82f6',
                                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, zIndex: 2
                                            }}>
                                                {isCarryOver ? '🏨' : String.fromCharCode(65 + visibleIdx - (typeof activeView === 'number' && activeView > 0 ? 1 : 0))}
                                            </div>
                                            <div style={{ width: 2, flex: 1, background: '#94a3b8', margin: '4px 0' }} />
                                        </div>

                                        <div data-stop-id={(!place.isStartingPoint && !place.isEndingPoint && !isCarryOver) ? place.id : undefined} style={{
                                            flex: 1, display: 'flex', alignItems: 'center', background: isCarryOver ? 'rgba(245,243,255,0.85)' : 'rgba(255,255,255,0.8)',
                                            border: `1px solid ${isCarryOver ? 'rgba(221,214,254,0.6)' : 'rgba(255,255,255,0.5)'}`, borderRadius: 16, padding: isMobile ? '12px' : '16px',
                                            boxShadow: '0 8px 32px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.6)', position: 'relative', marginBottom: 16,
                                            opacity: draggingId === place.id ? 0.35 : (place.isStartingPoint || place.isEndingPoint) ? 0.9 : 1,
                                            flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0,
                                            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
                                        }}>
                                            {/* Drag Handle (Hidden for start/end and guests) */}
                                            {!place.isStartingPoint && !place.isEndingPoint && !isCarryOver && !isGuest && (
                                                <div
                                                    className="itin-drag-handle"
                                                    onPointerDown={(e) => startDrag(e, place)}
                                                    title="Drag to reorder"
                                                    style={{ display:'flex', flexDirection:'column', paddingRight: isMobile ? 12 : 16, borderRight:'1px solid #f1f5f9', color:'#94a3b8', alignItems:'center', justifyContent:'center' }}
                                                >
                                                    <button type="button" onClick={() => handleMovePlace(orderedPlaces.findIndex(p => p.id === place.id), -1)} disabled={orderedPlaces.findIndex(p => p.id === place.id) === 0} style={{ background: 'none', border: 'none', cursor: orderedPlaces.findIndex(p => p.id === place.id) === 0 ? 'default' : 'pointer', color: orderedPlaces.findIndex(p => p.id === place.id) === 0 ? '#e2e8f0' : '#6b7280', minWidth:44, minHeight:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>▲</button>
                                                    <GripVertical size={18} style={{ margin: '4px 0' }} aria-hidden="true" />
                                                    <button type="button" onClick={() => handleMovePlace(orderedPlaces.findIndex(p => p.id === place.id), 1)} disabled={orderedPlaces.findIndex(p => p.id === place.id) === orderedPlaces.length - 1} style={{ background: 'none', border: 'none', cursor: orderedPlaces.findIndex(p => p.id === place.id) === orderedPlaces.length - 1 ? 'default' : 'pointer', color: orderedPlaces.findIndex(p => p.id === place.id) === orderedPlaces.length - 1 ? '#e2e8f0' : '#6b7280', minWidth:44, minHeight:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>▼</button>
                                                </div>
                                            )}

                                            {/* Image */}
                                            <div style={{ marginLeft: (!place.isStartingPoint && !place.isEndingPoint) ? (isMobile ? 12 : 16) : 0, flexShrink: 0 }}>
                                                <PlaceThumb
                                                    place={(place.isStartingPoint || place.isEndingPoint)
                                                        ? { ...place, category: place.isStartingPoint ? 'start' : 'end' }
                                                        : place}
                                                    size={isMobile ? 60 : 80}
                                                    radius={12}
                                                />
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, marginLeft: isMobile ? 12 : 16, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0 }}>
                                                    <div style={{ flex: isMobile ? '1 1 100%' : 1, minWidth: 0 }}>
                                                        {isCarryOver && (
                                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#172E6E', background: '#E5EDFB', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 6 }}>
                                                                🌙 Previous night — starting from here
                                                            </div>
                                                        )}
                                                        {isAfterHours && (
                                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fbbf24', padding: '6px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, width: '100%' }}>
                                                                <span>⚠️ Likely closed/unsafe at this hour</span>
                                                                {forcedDayBreaks.has(place.id) ? (
                                                                    <button type="button"
                                                                        onClick={() => setForcedDayBreaks(prev => { const n = new Set(prev); n.delete(place.id); return n; })}
                                                                        style={{ background: '#fff', border: '1px solid #fbbf24', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#92400e', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                                    >↩ Undo</button>
                                                                ) : (
                                                                    <button type="button"
                                                                        onClick={() => setForcedDayBreaks(prev => new Set([...prev, place.id]))}
                                                                        style={{ background: '#f59e0b', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                                    >→ Move to next day</button>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{place.name}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, marginBottom: 8 }}>
                                                            <MapPin size={12} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 160 : 250 }}>{place.description || place.name}</span>
                                                        </div>
                                                    </div>
                                                    {/* Duration Edit (Hidden for Start/End) */}
                                                    {!place.isStartingPoint && !place.isEndingPoint && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, background: '#f8fafc', padding: isMobile ? '6px 8px' : '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', position: 'relative', flexShrink: 0, marginTop: isMobile ? 6 : 0, width: isMobile ? '100%' : 'auto', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                                                            <Clock size={14} color="#64748b" />
                                                            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Visit Duration:</span>
                                                            {isGuest ? (
                                                                <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{durationMinutes} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>min</span></span>
                                                            ) : loadingDurations && !userOverrides[place.id] ? (
                                                                <span style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <span className="spinner" style={{ width: 10, height: 10, border: '2px solid #E5EDFB', borderTopColor: '#1E3A8A', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                                                                    AI timing…
                                                                </span>
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={durationMinutes}
                                                                        onChange={(e) => handleDurationChange(place.id, parseInt(e.target.value) || 0)}
                                                                        style={{ width: isMobile ? 64 : 56, padding: isMobile ? '6px' : '4px', borderRadius: 6, border: '1px solid #94a3b8', fontSize: 16, fontWeight: 700, color: '#0f172a', textAlign: 'center', outline: 'none' }}
                                                                    />
                                                                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>min</span>
                                                                    {!userOverrides[place.id] && placeDurations[place.id] !== undefined && (
                                                                        <span title="AI suggested" style={{ fontSize: 10, color: '#1E3A8A', fontWeight: 700, background: '#E5EDFB', padding: '1px 5px', borderRadius: 3 }}>AI ✦</span>
                                                                    )}
                                                                    {aiDaysMeta[place.id] > 1 && (
                                                                        <span title={`AI recommends ${aiDaysMeta[place.id]} days here`} style={{ fontSize: 10, color: '#0369a1', fontWeight: 700, background: '#e0f2fe', padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                                                                            📅 {aiDaysMeta[place.id]}-day destination
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 15 }}>
                                                            {arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        {!place.isStartingPoint && !place.isEndingPoint && (
                                                            <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                                                                until {departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {potentialPlaceMeal > 0 && !placeMealCancelled && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, flexWrap: 'wrap' }}>
                                                            <span style={{ color: '#94a3b8' }}>•</span>
                                                            <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                🍽️ meal break
                                                            </span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={potentialPlaceMeal}
                                                                    onChange={(e) => handleDurationChange(placeMealBreakId, parseInt(e.target.value) || 0)}
                                                                    style={{ width: isMobile ? 56 : 48, padding: isMobile ? '4px' : '2px', borderRadius: 6, border: '1px solid #94a3b8', fontSize: 16, fontWeight: 700, color: '#0f172a', textAlign: 'center', outline: 'none' }}
                                                                />
                                                                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>m</span>
                                                            </div>
                                                            <button type="button" onClick={() => toggleBreak(placeMealBreakId)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', padding: isMobile ? '4px 8px' : '2px 6px', borderRadius: 4, fontWeight: 600, minHeight:32 }}>Cancel</button>
                                                        </div>
                                                    )}
                                                    {potentialPlaceMeal > 0 && placeMealCancelled && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, flexWrap: 'wrap' }}>
                                                            <span style={{ color: '#94a3b8' }}>•</span>
                                                            <span style={{ color: '#6b7280', fontSize: 12, textDecoration: 'line-through' }}>
                                                                🍽️ Meal break ({potentialPlaceMeal}m)
                                                            </span>
                                                            <button type="button" onClick={() => toggleBreak(placeMealBreakId)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 11, cursor: 'pointer', padding: isMobile ? '4px 8px' : '2px 6px', borderRadius: 4, fontWeight: 600, minHeight:32 }}>Restore</button>
                                                        </div>
                                                    )}

                                                    {isNightStay && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                                                            <span style={{ color: '#94a3b8' }}>•</span>
                                                            <span style={{ color: '#172E6E', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                🌙 Night Stay
                                                            </span>
                                                            <button type="button" onClick={() => setRemovedNightStays(prev => new Set([...prev, place.id]))} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', padding: isMobile ? '4px 8px' : '2px 6px', borderRadius: 4, fontWeight: 600, minHeight: 32 }}>Cancel</button>
                                                        </div>
                                                    )}
                                                    {removedNightStays.has(place.id) && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                                                            <span style={{ color: '#94a3b8' }}>•</span>
                                                            <span style={{ color: '#6b7280', fontSize: 12, textDecoration: 'line-through' }}>
                                                                🌙 Night Stay
                                                            </span>
                                                            <button type="button" onClick={() => setRemovedNightStays(prev => { const n = new Set(prev); n.delete(place.id); return n; })} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 11, cursor: 'pointer', padding: isMobile ? '4px 8px' : '2px 6px', borderRadius: 4, fontWeight: 600, minHeight: 32 }}>Restore</button>
                                                        </div>
                                                    )}
                                                    {isSpansMidnight && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                                                            <span style={{ color: '#94a3b8' }}>•</span>
                                                            <span style={{ color: '#15803d', fontSize: 12, fontWeight: 600 }}>📅 Spans 2 days</span>
                                                        </div>
                                                    )}
                                                    {isCheckInStop && !removedNightStays.has(place.id) && (
                                                        <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, marginLeft: 'auto' }}>
                                                            Check-in Stop
                                                        </span>
                                                    )}
                                                    {place.isStartingPoint && (
                                                        <span style={{ background: '#d1fae5', color: '#059669', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, marginLeft: 'auto' }}>
                                                            Starting Point
                                                        </span>
                                                    )}
                                                    {place.isEndingPoint && (
                                                        <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, marginLeft: 'auto' }}>
                                                            Ending Point
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transit Line */}
                                    {visibleIdx < visibleTimeline.length - 1 && (isCarryOver || !(isNightStay || isSpansMidnight)) && (
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                                            <div style={{ width: 32, display: 'flex', justifyContent: 'center', marginRight: 16 }}>
                                                <div style={{ width: 2, height: 40, background: '#94a3b8' }} />
                                            </div>
                                            {(transitMinutes > 0 || transitDistance === 'Unroutable') && (() => {
                                                // Meals (and night stays) always show under the drive. Tea
                                                // breaks fold into one line ("6 tea breaks · 1 hr 30 mins");
                                                // the arrow opens the full list, in time order, for editing.
                                                const legKey = `${place.id}-${isCarryOver ? 'carry' : 'main'}`;
                                                const open = openLegs.has(legKey);
                                                const events = transitEvents || [];
                                                const teas = events.filter(e => e.type === 'rest');
                                                const activeTeas = teas.filter(e => !e.isCancelled);
                                                const skipped = teas.length - activeTeas.length;
                                                const teaMinutes = activeTeas.reduce((n, e) => n + (e.duration || 0), 0);
                                                const summary = activeTeas.length
                                                    ? `${activeTeas.length} tea break${activeTeas.length > 1 ? 's' : ''} · ${formatDuration(teaMinutes)}`
                                                    : 'Add a break';
                                                const shown = open ? events : events.filter(e => e.type !== 'rest');
                                                return (
                                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                    {transitDistance === 'Unroutable' ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, fontWeight: 600, paddingLeft: 32, marginBottom: 8 }}>
                                                            ⚠️ Route unavailable (Flight or ferry required)
                                                        </div>
                                                    ) : (
                                                        <div className="itin-drive">
                                                            <span className="itin-drive-label">
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                                                                Drive {formatDuration(transitMinutes)} {transitDistance && <span style={{ color: '#6b7280', fontWeight: 500, fontSize: 12 }}>({transitDistance})</span>}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className={`itin-breaks-toggle${open ? ' is-open' : ''}`}
                                                                onClick={() => toggleLeg(legKey)}
                                                                aria-expanded={open}
                                                                aria-label={`${summary}${skipped ? `, ${skipped} skipped` : ''} — ${open ? 'hide' : 'show and edit'} breaks`}
                                                            >
                                                                <span aria-hidden="true">{activeTeas.length ? '☕' : '＋'}</span>
                                                                {summary}
                                                                {skipped > 0 && <span className="itin-breaks-skipped">· {skipped} skipped</span>}
                                                                <ChevronDown size={14} className="itin-breaks-chevron" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {transitDistance !== 'Unroutable' && (open || shown.length > 0) && (
                                                        <div className="itin-breaks">
                                                            {shown.map(event => (
                                                                <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 22, marginTop: 4, flexWrap: 'wrap' }}>
                                                                    {!event.isCancelled ? (
                                                                        <>
                                                                            <span style={{ color: event.type === 'meal' ? '#f59e0b' : event.type === 'night_stay' ? '#172E6E' : '#10b981', fontSize: 12 }}>
                                                                                {event.type === 'meal' ? '🍽️' : event.type === 'night_stay' ? '🏨' : '☕'}
                                                                            </span>
                                                                            <span style={{ color: '#475569', fontSize: 12, fontWeight: 600 }}>
                                                                                {event.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={event.duration}
                                                                                    onChange={(e) => handleDurationChange(event.id, parseInt(e.target.value) || 0)}
                                                                                    style={{ width: isMobile ? 56 : 48, padding: isMobile ? '3px 4px' : '1px 2px', borderRadius: 4, border: '1px solid #94a3b8', fontSize: 16, fontWeight: 700, color: '#0f172a', textAlign: 'center', outline: 'none' }}
                                                                                />
                                                                                <span style={{ fontSize: 11, color: '#64748b' }}>m {event.name.toLowerCase()}</span>
                                                                            </div>
                                                                            <button type="button" onClick={() => toggleBreak(event.id)} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: 10, cursor: 'pointer', padding: isMobile ? '4px 8px' : '1px 4px', fontWeight: 600, minHeight:28 }}>Skip</button>
                                                                            <button type="button" onClick={() => deleteBreak(event.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 10, cursor: 'pointer', padding: isMobile ? '4px 8px' : '1px 4px', fontWeight: 600, minHeight:28 }}>✕</button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span style={{ color: '#6b7280', fontSize: 12, textDecoration: 'line-through' }}>
                                                                                {event.type === 'meal' ? '🍽️' : event.type === 'night_stay' ? '🏨' : '☕'} {event.name} ({event.duration}m)
                                                                            </span>
                                                                            <button type="button" onClick={() => toggleBreak(event.id)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 10, cursor: 'pointer', padding: isMobile ? '4px 8px' : '1px 4px', fontWeight: 600, minHeight:28 }}>Restore</button>
                                                                            <button type="button" onClick={() => deleteBreak(event.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 10, cursor: 'pointer', padding: isMobile ? '4px 8px' : '1px 4px', fontWeight: 600, minHeight:28 }}>✕</button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ))}

                                                            {open && (
                                                            <div style={{ display: 'flex', gap: 8, marginLeft: 22, marginTop: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                                        <button type="button"
                                                            onClick={() => addManualBreak(idx, 'meal')}
                                                            style={{ background: 'none', border: '1px dashed #f59e0b', color: '#f59e0b', fontSize: 10, cursor: 'pointer', padding: isMobile ? '4px 10px' : '2px 8px', borderRadius: 4, fontWeight: 600, minHeight:32 }}
                                                        >+ Meal</button>
                                                        <button type="button"
                                                            onClick={() => addManualBreak(idx, 'rest')}
                                                            style={{ background: 'none', border: '1px dashed #10b981', color: '#10b981', fontSize: 10, cursor: 'pointer', padding: isMobile ? '4px 10px' : '2px 8px', borderRadius: 4, fontWeight: 600, minHeight:32 }}
                                                        >+ Rest</button>
                                                        <button type="button"
                                                            onClick={() => addManualBreak(idx, 'night_stay')}
                                                            style={{ background: 'none', border: '1px dashed #172E6E', color: '#172E6E', fontSize: 10, cursor: 'pointer', padding: isMobile ? '4px 10px' : '2px 8px', borderRadius: 4, fontWeight: 600, minHeight:32 }}
                                                        >+ Night Stay</button>
                                                    </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </Fragment>
                            );
                        })
                    )}

                    {visibleTimeline.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: 0 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                                🏁
                            </div>
                            <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: isMobile ? '10px 16px' : '12px 24px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', flex: 1 }}>
                                {(() => {
                                    const lastItem = visibleTimeline[visibleTimeline.length - 1];
                                    const isNightEnd = lastItem?.isNightStay;
                                    const endTime = isNightEnd ? lastItem.arrivalTime : lastItem.departureTime;
                                    const label = activeView === 'full' ? 'Trip' : `Day ${typeof activeView === 'number' ? activeView + 1 : ''}`;
                                    return (
                                        <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: '#0f172a' }}>
                                            {label} Ends At: {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {isNightEnd && <span style={{ fontSize: 12, color: '#172E6E', fontWeight: 600, marginLeft: 8 }}>🏨 Night stay at {lastItem.place.name}</span>}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Tabbed: AI Suggestions / On the Way / Nearby */}
            {isMobile && sidebarMinimized ? (
                /* Mobile Minimized Handle */
                <button type="button"
                    onClick={() => setSidebarMinimized(false)}
                    style={{
                        width: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '12px 16px', minHeight: 48, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderTop: '1px solid rgba(255,255,255,0.5)',
                        border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569'
                    }}
                >
                    <ChevronUp size={16} />
                    <span>{
                        sidebarTab === 'ai' ? '✨ AI Suggestions' :
                        sidebarTab === 'onway' ? '🛣️ On the Way' : '🔍 Nearby'
                    }</span>
                </button>
            ) : (
            <div style={{ width: isMobile ? '100%' : 320, background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.5)', borderTop: isMobile ? '1px solid rgba(255,255,255,0.5)' : 'none', padding: isMobile ? '16px 0' : '24px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(15,23,42,0.08)', flexShrink: 0 }}>
                {/* Sidebar Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {[{ id: 'ai', label: '✨ AI' }, { id: 'onway', label: '🛣️ On the Way' }, { id: 'nearby', label: '🔍 Nearby' }].map(tab => (
                        <button type="button"
                            key={tab.id}
                            onClick={() => setSidebarTab(tab.id)}
                            style={{
                                flex: '0 0 auto', padding: isMobile ? '8px 12px' : '8px 14px', borderRadius: 20, fontSize: isMobile ? 12 : 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                                background: sidebarTab === tab.id ? '#0f172a' : '#fff',
                                color: sidebarTab === tab.id ? '#fff' : '#6b7280',
                                borderColor: sidebarTab === tab.id ? '#0f172a' : '#e2e8f0',
                                transition: 'all 200ms', whiteSpace: 'nowrap', minHeight: 36
                            }}
                        >{tab.label}</button>
                    ))}
                    {isMobile && (
                        <button type="button"
                            onClick={() => setSidebarMinimized(true)}
                            title="Minimize"
                            style={{
                                marginLeft: 'auto', flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
                                border: '1.5px solid #e2e8f0', background: '#fff', color: '#6b7280',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                            }}
                        >
                            <ChevronDown size={16} />
                        </button>
                    )}
                </div>

                <div style={{ flex: 1, padding: '0 16px', overflowY: 'auto' }}>
                    {/* AI Suggestions Tab */}
                    {sidebarTab === 'ai' && (
                        <>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>AI-powered recommendations based on your route</p>
                            {loadingAI ? (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <div className="spinner spinner-sm" style={{ borderTopColor: '#0f172a', marginBottom: 12 }}></div>
                                    <div style={{ fontSize: 13, color: '#64748b' }}>Finding local gems...</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {aiSuggestions.map((sug, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid #f1f5f9', borderRadius: 12, cursor: 'pointer', transition: 'border 200ms' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'} onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                                            <PlaceThumb place={sug} size={60} radius={8} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4, lineHeight: 1.2 }}>{sug.name}</div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>{sug.category} · {1 + (i % 2)} hr</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* On the Way Tab */}
                    {sidebarTab === 'onway' && (
                        <>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Must-visit stops between your route checkpoints</p>
                            <button type="button"
                                onClick={async () => {
                                    if (orderedPlaces.length < 2) return;
                                    setLoadingOnWay(true);
                                    try {
                                        const { getRouteMustVisits } = await import('../config/openai');
                                        const results = [];
                                        for (let i = 0; i < orderedPlaces.length - 1; i++) {
                                            const r = await getRouteMustVisits(orderedPlaces[i].name, orderedPlaces[i + 1].name, []);
                                            (r.suggestions || []).forEach(s => results.push({ ...s, between: `${orderedPlaces[i].name} → ${orderedPlaces[i + 1].name}` }));
                                        }
                                        setOnWayResults(results);
                                    } catch (e) { console.error(e); } finally { setLoadingOnWay(false); }
                                }}
                                style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16, minHeight:40 }}
                            >{loadingOnWay ? 'Fetching…' : '🛣️ Find stops on my route'}</button>
                            {onWayResults.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {onWayResults.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, alignItems: 'flex-start' }}>
                                            <PlaceThumb place={r} size={52} radius={8} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 700, marginBottom: 2 }}>🛣️ {r.between}</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                                            </div>
                                            <button type="button"
                                                onClick={() => addToItinerary(r)}
                                                style={{ flexShrink: 0, background: '#EEF3FC', color: '#1E3A8A', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'center', whiteSpace: 'nowrap', minHeight: 32 }}
                                            >+ Add</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Nearby Tab */}
                    {sidebarTab === 'nearby' && (
                        <>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Search for places near your current stops</p>
                            <div style={{ display: 'flex', gap: 8, marginBottom: nearbyResults.length ? 12 : 0, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <LocationAutocomplete
                                        value={nearbyQuery}
                                        onChange={(val) => setNearbyQuery(val)}
                                        onSelect={async (p) => {
                                            const query = p ? p.name : nearbyQuery;
                                            if (!query || !orderedPlaces[0]) return;
                                            setLoadingNearby(true);
                                            try {
                                                const { searchNearby } = await import('../services/placesService');
                                                const r = await searchNearby({ lat: orderedPlaces[0].lat, lng: orderedPlaces[0].lng, query });
                                                setNearbyResults(r);
                                            } catch (e) { console.error(e); } finally { setLoadingNearby(false); }
                                        }}
                                        placeholder="e.g. cafe, temple, beach..."
                                    />
                                </div>
                                <button type="button"
                                    onClick={async () => {
                                        if (!nearbyQuery.trim() || !orderedPlaces[0]) return;
                                        setLoadingNearby(true);
                                        try {
                                            const { searchNearby } = await import('../services/placesService');
                                            const r = await searchNearby({ lat: orderedPlaces[0].lat, lng: orderedPlaces[0].lng, query: nearbyQuery.trim() });
                                            setNearbyResults(r);
                                        } catch (e) { console.error(e); } finally { setLoadingNearby(false); }
                                    }}
                                    style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36 }}
                                >{loadingNearby ? '…' : '🔍'}</button>
                            </div>
                            {loadingNearby && (
                                <div style={{ textAlign: 'center', padding: 20 }}>
                                    <div className="spinner spinner-sm" style={{ borderTopColor: '#0f172a', margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: 12, color: '#64748b' }}>Searching nearby…</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: nearbyResults.length ? 4 : 0 }}>
                                {nearbyResults.map((r, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, alignItems: 'flex-start' }}>
                                        <PlaceThumb place={r} size={52} radius={8} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                                            {r.rating && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>⭐ {r.rating}</div>}
                                        </div>
                                        <button type="button"
                                            onClick={() => addToItinerary(r)}
                                            style={{ flexShrink: 0, background: '#EEF3FC', color: '#1E3A8A', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'center', whiteSpace: 'nowrap', minHeight: 32 }}
                                        >+ Add</button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            )}

            {/* Break Edit Modal */}
            <Modal open={!!editingBreak} onClose={() => setEditingBreak(null)} title={editingBreak?.isNew ? 'Add Break' : 'Edit Break'}>
                {editingBreak && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Name</label>
                            <input
                                type="text"
                                value={editingBreak.name}
                                onChange={e => setEditingBreak(p => ({ ...p, name: e.target.value }))}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Duration (minutes)</label>
                            <input
                                type="number"
                                min={5}
                                step={5}
                                value={editingBreak.duration}
                                onChange={e => setEditingBreak(p => ({ ...p, duration: parseInt(e.target.value) || 15 }))}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>After driving (minutes)</label>
                            <input
                                type="number"
                                min={0}
                                step={5}
                                value={editingBreak.afterDriveMinutes}
                                onChange={e => setEditingBreak(p => ({ ...p, afterDriveMinutes: parseInt(e.target.value) || 0 }))}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button type="button" onClick={handleSaveBreak} style={{ flex: 1, background: '#0f172a', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>
                                Save
                            </button>
                            <button type="button" onClick={() => setEditingBreak(null)} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default function ItineraryPage() {
    usePageSeo({ title: 'Trip Itinerary', robots: 'noindex, nofollow' });
    const [showMap, setShowMap] = useState(false);
    // The map needs Google Maps. Without a key, never mount MapView (its
    // <Map> would render outside an APIProvider and crash) or its toggle.
    const mapOpen = showMap && MAPS_ENABLED;
    return (
        <MapsProvider>
            {/* ItineraryContent stays mounted (just hidden) while the map is
                shown so unsaved schedule edits — manual breaks, skipped/deleted
                breaks, day-split adjustments — survive the toggle. */}
            <div style={{ display: mapOpen ? 'none' : 'contents' }}>
                <ItineraryContent onOpenMap={MAPS_ENABLED ? () => setShowMap(true) : null} />
            </div>
            {mapOpen && <MapView onExitMap={() => setShowMap(false)} exitLabel="Itinerary" />}
        </MapsProvider>
    );
}
