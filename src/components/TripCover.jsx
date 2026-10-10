// src/components/TripCover.jsx
// A trip card's cover, drawn from the trip itself instead of stock photos:
//   • the route — the stops' real positions, projected and joined by a
//     glowing path, so every trip has its own shape;
//   • a boarding-pass header (HYD → GOA) and the trip's stops and days;
//   • a palette picked from the destination — sea, mountains, desert,
//     forest, or city dusk — over a faint contour texture.
// No photos to fetch and no Maps calls: it renders instantly.
import { useEffect, useMemo, useState } from 'react';
import { routeShapeFrom, orderPlaces } from '../utils/routeShape';

const THEMES = [
    { id: 'sea', emoji: '🏖️', test: /beach|goa|island|coast|kerala|bali|maldiv|andaman|phuket|krabi|gokarna|puducherry|pondicherry|varkala|riviera|lagoon|bay\b|seychell|mauritius|santorini|cyclad|greece|albania|montenegro|vietnam|thailand/ },
    { id: 'mountain', emoji: '🏔️', test: /spiti|shimla|manali|ladakh|\bleh\b|kashmir|himalay|sikkim|darjeeling|alps|everest|kalpa|chitkul|munnar|ooty|hill|trek|valley|tawang|kedarnath|rishikesh|nepal|bhutan|caucasus|georgia|armenia|switzerland|slovenia|uttarakhand|meghalaya/ },
    { id: 'desert', emoji: '🏜️', test: /rajasthan|jaisalmer|jaipur|jodhpur|dubai|sahara|desert|kutch|udaipur|bikaner|abu dhabi|saudi|oman|jordan|morocco|egypt|uzbek|silk road/ },
    { id: 'forest', emoji: '🌿', test: /forest|wildlife|safari|jungle|national park|waterfall|coorg|wayanad|chikmagalur|dandeli|sundarban|kaziranga|costa rica|amazon/ },
];
const CITY = { id: 'city', emoji: '🏙️' };

function themeFor(trip) {
    const text = `${trip.destination || ''} ${trip.name || ''} ${(trip.publicHighlights || []).join(' ')}`.toLowerCase();
    return THEMES.find(t => t.test.test(text)) || CITY;
}

/** "Hyderabad, Telangana" → "HYD". */
function code(name) {
    const word = (name || '').split(',')[0].replace(/[^A-Za-z]/g, '');
    return word.slice(0, 3).toUpperCase();
}

function daysOf(trip) {
    if (!trip.startDate || !trip.endDate) return null;
    const d = Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1;
    return d > 0 ? d : null;
}

// Trips planned before covers existed have no stored routeShape; fetch their
// stop positions once per session (lat/lng only).
const shapeCache = new Map();
function fetchShape(trip) {
    if (!shapeCache.has(trip.id)) {
        shapeCache.set(trip.id, import('../services/publicFirestoreService')
            .then(m => m.publicGetTripStops(trip.id))
            .then(stops => routeShapeFrom(orderPlaces(stops, trip.placeOrder)))
            .catch(() => []));
    }
    return shapeCache.get(trip.id);
}

function useRouteShape(trip) {
    const stored = trip.routeShape?.length ? trip.routeShape : null;
    const [fetched, setFetched] = useState(null);
    useEffect(() => {
        if (stored || !trip.id) return;
        let alive = true;
        fetchShape(trip).then(shape => { if (alive) setFetched(shape); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trip.id, stored]);
    return stored || fetched;
}

// ── Drawing ────────────────────────────────────────────────────────────────
const W = 240, H = 120, PAD = 14;

/** Project lat/lng into the drawing box, same scale on both axes. */
function project(points) {
    const meanLat = points.reduce((n, p) => n + p.lat, 0) / points.length;
    const k = Math.cos((meanLat * Math.PI) / 180);
    const xy = points.map(p => [p.lng * k, -p.lat]);
    const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const spanX = Math.max(Math.max(...xs) - minX, 0.02);
    const spanY = Math.max(Math.max(...ys) - minY, 0.02);
    // True proportions, except a route that runs mostly one way (Goa's coast
    // to Dudhsagar, say) may stretch its narrow axis up to 2.2× — otherwise it
    // collapses into a flat line. The shape stays recognisably the same.
    const fitX = (W - PAD * 2) / spanX, fitY = (H - PAD * 2) / spanY;
    const base = Math.min(fitX, fitY);
    const sx = Math.min(fitX, base * 2.2), sy = Math.min(fitY, base * 2.2);
    const offX = (W - spanX * sx) / 2, offY = (H - spanY * sy) / 2;
    return xy.map(([x, y]) => [offX + (x - minX) * sx, offY + (y - minY) * sy]);
}

/**
 * Each leg as a gentle arc, the way travel posters draw flight paths: a
 * quadratic curve bowed sideways by a fifth of the leg's length.
 */
function arcPath(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const dx = x2 - x1, dy = y2 - y1;
        const bow = 0.2;
        const cx = (x1 + x2) / 2 - dy * bow, cy = (y1 + y2) / 2 + dx * bow;
        d += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    return d;
}

const hasXY = (p) => p && p.lat != null && p.lng != null;

/**
 * @param trip           the trip doc (or a public listing)
 * @param past           a finished trip — drawn faded, stamped "Completed"
 * @param withEndpoints  include the trip's start/end points (own trips only;
 *                       never on public cards, where they could be a home)
 */
export default function TripCover({ trip, past = false, withEndpoints = false, children }) {
    const theme = themeFor(trip);
    const shape = useRouteShape(trip);

    // A round trip (ends where it starts) closes the loop back to the start
    // marker instead of stacking an end pin on top of it.
    const { points, startIdx, endIdx } = useMemo(() => {
        const pts = [...(shape || [])];
        let s = -1, e = pts.length - 1;
        const start = withEndpoints && hasXY(trip.startingPoint) ? trip.startingPoint : null;
        const end = withEndpoints && hasXY(trip.endingPoint) ? trip.endingPoint : null;
        if (start) { pts.unshift(start); s = 0; e += 1; }
        if (end) {
            pts.push(end);
            const round = start && Math.abs(end.lat - start.lat) < 0.01 && Math.abs(end.lng - start.lng) < 0.01;
            e = round ? -1 : pts.length - 1;
        }
        if (pts.length < 2 || e === s) e = -1;
        return { points: pts, startIdx: s, endIdx: e };
    }, [shape, withEndpoints, trip.startingPoint, trip.endingPoint]);

    const drawn = useMemo(() => (points.length ? project(points) : []), [points]);
    const path = useMemo(() => arcPath(drawn), [drawn]);

    const startName = withEndpoints ? trip.startingPoint?.name : null;
    const dest = (trip.destination || trip.name || '').split(',')[0].trim();
    const header = startName && code(startName) && code(dest) && code(startName) !== code(dest)
        ? `${code(startName)} → ${code(dest)}`
        : code(dest) || '✈';
    const stops = trip.publicStopCount ?? shape?.length ?? 0;
    const days = daysOf(trip);
    const facts = [stops ? `${stops} stop${stops > 1 ? 's' : ''}` : null, days ? `${days} day${days > 1 ? 's' : ''}` : null].filter(Boolean);
    const loading = !shape && !trip.routeShape?.length;

    return (
        <div className={`trip-cover theme-${theme.id}${past ? ' is-past' : ''}`} aria-hidden="true">
            {/* Faint terrain contours */}
            <svg className="trip-cover-contours" viewBox="0 0 400 150" preserveAspectRatio="none">
                {[0, 1, 2, 3, 4].map(i => (
                    <path key={i} d={`M-10 ${30 + i * 26} C 80 ${10 + i * 26}, 160 ${60 + i * 24}, 250 ${28 + i * 26} S 380 ${12 + i * 28}, 420 ${40 + i * 24}`} />
                ))}
            </svg>
            <span className="trip-cover-emoji">{theme.emoji}</span>

            <div className="trip-cover-text">
                <span className="trip-cover-code">{header}</span>
                <span className="trip-cover-name">{startName ? `${startName.split(',')[0]} → ${dest}` : dest}</span>
                {facts.length > 0 && <span className="trip-cover-facts">{facts.join(' · ')}</span>}
            </div>

            <svg className="trip-cover-route" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
                {drawn.length >= 2 && (
                    <>
                        <path className="trip-cover-path-glow" d={path} />
                        <path className="trip-cover-path" d={path} pathLength="1" />
                    </>
                )}
                {drawn.map(([x, y], i) => {
                    if (i === startIdx) return <circle key={i} className="trip-cover-start" cx={x} cy={y} r="5" />;
                    if (i === endIdx) {
                        return <g key={i}><circle className="trip-cover-end-halo" cx={x} cy={y} r="8" /><circle className="trip-cover-end" cx={x} cy={y} r="4.5" /></g>;
                    }
                    // A round trip's closing point sits on the start marker.
                    if (startIdx === 0 && i === drawn.length - 1 && endIdx === -1 && withEndpoints && hasXY(trip.endingPoint)) return null;
                    return <circle key={i} className="trip-cover-stop" cx={x} cy={y} r="3.6" />;
                })}
                {drawn.length === 1 && <circle className="trip-cover-end-halo is-pulse" cx={drawn[0][0]} cy={drawn[0][1]} r="10" />}
                {!drawn.length && !loading && (
                    <path className="trip-cover-path is-idle" d={`M ${PAD} ${H * 0.62} C ${W * 0.3} ${H * 0.2}, ${W * 0.6} ${H * 0.95}, ${W - PAD} ${H * 0.4}`} pathLength="1" />
                )}
            </svg>

            {past && <span className="trip-cover-stamp">Completed</span>}
            {children}
        </div>
    );
}
