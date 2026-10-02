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

/** ₹1,23,456 — Indian digit grouping, matching the rest of the app. */
export function formatInr(n) {
    if (n == null || Number.isNaN(n)) return '—';
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
