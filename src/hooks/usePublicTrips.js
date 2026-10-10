// src/hooks/usePublicTrips.js
// Trips listed on Public Trips, fetched once and shared for a minute so the
// home page and the Public Trips tab don't each query on every visit.
import { useEffect, useState } from 'react';

const FRESH_MS = 60 * 1000;
let cached = null;     // { at, trips }
let inFlight = null;   // Promise<trips>

function load() {
    if (cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached.trips);
    if (!inFlight) {
        inFlight = import('../services/publicFirestoreService')
            .then(m => m.publicListTrips())
            .then(trips => { cached = { at: Date.now(), trips }; return trips; })
            .finally(() => { inFlight = null; });
    }
    return inFlight;
}

/**
 * @param {{ defer?: boolean }} options defer — wait for the browser to be idle
 *   first, so the home page's own content loads before this does.
 * @returns {{ trips: object[] | null, error: boolean }} trips is null while loading
 */
export default function usePublicTrips({ defer = false } = {}) {
    const [state, setState] = useState(() => ({ trips: cached?.trips ?? null, error: false }));

    useEffect(() => {
        let alive = true;
        const run = () => load().then(
            trips => { if (alive) setState({ trips, error: false }); },
            () => { if (alive) setState(s => ({ trips: s.trips ?? [], error: true })); },
        );
        if (!defer) { run(); return () => { alive = false; }; }
        const idle = window.requestIdleCallback
            ? window.requestIdleCallback(run, { timeout: 2500 })
            : window.setTimeout(run, 1200);
        return () => {
            alive = false;
            if (window.cancelIdleCallback) window.cancelIdleCallback(idle); else window.clearTimeout(idle);
        };
    }, [defer]);

    return state;
}
