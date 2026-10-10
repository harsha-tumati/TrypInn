// src/services/tripPlans.js
// Reads the pre-built trip plans that scripts/generate-trip-plans.js writes to
// public/trip-plans/, and turns one into a real anonymous trip.
//
// Plans are static JSON keyed by destination, so a hundred "Solo Travel in
// Egypt"-style posts all share one cached Egypt plan rather than each reader
// paying for an AI round trip.

const PLAN_CACHE = new Map();

/**
 * Fetch a plan by id. Cached per session — the same plan backs many blogs, so
 * a reader moving between guides usually hits memory.
 */
export async function loadPlan(planId) {
    if (!planId) return null;
    if (PLAN_CACHE.has(planId)) return PLAN_CACHE.get(planId);

    const promise = fetch(`/trip-plans/plans/${planId}.json`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);

    // Cache the promise, not the result, so concurrent callers share one fetch.
    PLAN_CACHE.set(planId, promise);
    const plan = await promise;
    if (!plan) PLAN_CACHE.delete(planId); // let a transient failure retry
    return plan;
}

/** Recompute an estimate client-side when the reader changes days or party size. */
export function scaleEstimate(estimate, days, people) {
    if (!estimate) return null;
    const round = n => (n >= 100000 ? Math.round(n / 5000) * 5000
        : n >= 10000 ? Math.round(n / 500) * 500
            : n >= 1000 ? Math.round(n / 100) * 100
                : Math.round(n / 10) * 10);

    const tiers = {};
    for (const [key, tier] of Object.entries(estimate.tiers)) {
        const perDay = tier.perDayUsd * estimate.usdToInr;
        tiers[key] = {
            ...tier,
            perDayPerPerson: round(perDay),
            tripPerPerson: round(perDay * days),
            tripTotal: round(perDay * days * people),
        };
    }
    return { ...estimate, days, people, tiers };
}

/**
 * Create an anonymous trip from a plan and drop the plan's places into it.
 *
 * Mirrors what CreateTripPage does — no login required, the trip is a local
 * draft until it's claimed to a profile.
 *
 * @returns {Promise<string>} the new trip id
 */
export async function createTripFromPlan({ plan, days, people, tierKey = 'midRange' }) {
    const [{ createTrip, addPlaces }, { addDraftId }] = await Promise.all([
        import('./firestoreService'),
        import('../utils/draftTrips'),
    ]);

    const estimate = scaleEstimate(plan.estimate, days, people);
    const budget = estimate?.tiers?.[tierKey]?.tripTotal ?? null;

    const tripId = await createTrip({
        name: `${plan.title} trip`,
        destination: plan.destination || plan.title,
        description: `Planned from the Trypinn guide to ${plan.title}.`,
        startDate: null,
        endDate: null,
        budget,
        userId: null, // anonymous draft, same as CreateTripPage
        startingPoint: null,
        endingPoint: null,
    });

    // Resolve real coordinates and photos where Maps is available. The planner
    // needs coordinates to draw a route, but a trip with un-geocoded places is
    // still far more useful than no trip, so a failure here is not fatal.
    let places = plan.places;
    try {
        const { MAPS_ENABLED } = await import('../config/maps');
        if (MAPS_ENABLED) {
            const { enrichPlacesWithGoogle } = await import('./placesService');
            const enriched = await enrichPlacesWithGoogle(places, plan.destination || plan.title);
            places = enriched.map((p, i) => ({
                ...p,
                // Enrichment nulls imageUrl when Google has no photo; the
                // curated one is a real picture of the place, so keep it.
                imageUrl: p.imageUrl || places[i]?.imageUrl || null,
            }));
        }
    } catch {
        // Keep the un-enriched places.
    }

    // The trip already exists at this point. If seeding the places fails, the
    // reader is better off landing in an empty planner they can fill than
    // seeing an error and silently owning an orphaned trip.
    try {
        await addPlaces(tripId, places.map(p => ({
            name: p.name,
            description: p.description || '',
            category: p.category || 'place',
            estimatedMinutes: p.estimatedMinutes || 90,
            lat: p.lat ?? null,
            lng: p.lng ?? null,
            imageUrl: p.imageUrl || null,
            googlePlaceId: p.googlePlaceId || null,
        })));
    } catch (err) {
        if (import.meta.env.DEV) console.error('Seeding plan places failed:', err);
    }

    addDraftId(tripId);
    return tripId;
}

/** "Days 1–2" / "Day 3" / "" for a leg, as the article labels it. */
export function dayLabel(days) {
    if (!days) return '';
    return /[–-]/.test(days) ? `Days ${days}` : `Day ${days}`;
}

/**
 * Turn a suggested itinerary into a draft trip and return its id.
 *
 * Mirrors the home page's "plan a trip" flow (anonymous draft, start and end
 * points set), but every stop already carries coordinates and a Google place
 * id from build time, so the planner opens with the whole route pinned. That
 * matters: the itinerary page drops any place without coordinates.
 *
 * Stops are saved in the article's order and the order is written to the trip,
 * and each stop's description carries its day label so the planner list reads
 * the way the blog does.
 */
export async function createTripFromItinerary({ option, budget = null }) {
    const [{ createTrip, addPlaces, updatePlaceOrder }, { addDraftId }] = await Promise.all([
        import('./firestoreService'),
        import('../utils/draftTrips'),
    ]);

    let stops = option.legs.flatMap(leg => leg.stops.map(s => ({
        ...s,
        description: [dayLabel(leg.days), leg.base].filter(Boolean).join(' · '),
    })));

    // Build-time lookup normally covers every stop. If one was missed, fall
    // back to resolving it now rather than saving a pin-less place.
    if (stops.some(s => s.lat == null)) {
        try {
            const { MAPS_ENABLED } = await import('../config/maps');
            if (MAPS_ENABLED) {
                const { enrichPlacesWithGoogle } = await import('./placesService');
                const missing = stops.filter(s => s.lat == null);
                const enriched = await enrichPlacesWithGoogle(missing, option.country);
                const byName = new Map(enriched.map(e => [e.name, e]));
                stops = stops.map(s => (s.lat == null && byName.get(s.name)?.lat != null
                    ? { ...s, lat: byName.get(s.name).lat, lng: byName.get(s.name).lng, placeId: byName.get(s.name).googlePlaceId || s.placeId }
                    : s));
            }
        } catch { /* keep what we have */ }
    }

    const located = stops.filter(s => s.lat != null);
    const toPoint = s => (s ? { name: s.name, lat: s.lat, lng: s.lng, placeId: s.placeId || null, formatted: s.address || '' } : null);
    const summary = option.legs
        .map(l => [dayLabel(l.days), l.base].filter(Boolean).join(' '))
        .join(' → ');

    const tripId = await createTrip({
        name: option.title,
        destination: option.countries?.join(', ') || option.country,
        description: summary,
        startDate: null,
        endDate: null,
        budget,
        userId: null, // anonymous draft, claimed later — same as the home page flow
        startingPoint: toPoint(located[0]),
        endingPoint: toPoint(located[located.length - 1]),
    });

    const ids = await addPlaces(tripId, stops.map(s => ({
        name: s.name,
        description: s.description,
        category: s.cat || 'place',
        estimatedMinutes: s.min || 90,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        imageUrl: null,           // PlaceThumb fetches a real photo from the place id
        placeId: s.placeId || null,
        googlePlaceId: s.placeId || null,
        source: 'itinerary',
    })));
    // Without an explicit order the planner sorts by creation time, which a
    // parallel write could scramble. Pin it to the article's order.
    await updatePlaceOrder(tripId, ids);

    addDraftId(tripId);
    return tripId;
}

/** ₹1,23,456 — Indian digit grouping, matching the rest of the app. */
export function formatInr(n) {
    if (n == null || Number.isNaN(n)) return '—';
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
