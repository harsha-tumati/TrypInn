// src/components/PlaceThumb.jsx
// A consistent place thumbnail. Shows the real Google photo when available,
// lazily fetches one when it's missing, and falls back to a category emoji —
// never a misleading stock photo.
import { useState, useEffect, useRef } from 'react';
import { fetchPlaceImage, peekPlaceImage } from '../services/placesService';
import { MAPS_ENABLED } from '../config/maps';

const CATEGORY_EMOJI = {
    beach: '🏖️', temple: '🛕', museum: '🏛️', viewpoint: '🌄', market: '🛍️',
    heritage: '🏰', historical: '🏰', nature: '🌿', wildlife: '🦌', food: '🍜',
    restaurant: '🍽️', cafe: '☕', hotel: '🏨', accommodation: '🏨', park: '🌳',
    garden: '🌷', start: '🏠', end: '🏁', ai: '✨', hidden_gem: '💎',
    trending: '🔥', place: '📍', default: '📍',
};

function emojiFor(category) {
    return CATEGORY_EMOJI[(category || '').toLowerCase()] || CATEGORY_EMOJI.default;
}

// The nearest ancestor that scrolls. Lists like the itinerary scroll inside
// a panel, not the page; observing against the window would ignore the
// prefetch margin there and only start loading a photo once it's on screen.
function scrollParent(el) {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const { overflowY } = getComputedStyle(n);
        if ((overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
}

export default function PlaceThumb({ place, size = 60, radius = 12, className = '' }) {
    const directSrc = place?.imageUrl || place?.imageUrls?.[0] || null;
    const placeKey = place?.id ?? place?.name ?? '';
    const [fetched, setFetched] = useState(null);
    // 'direct' — the saved photo URL failed (they expire), so look one up;
    // 'all'    — the looked-up photo failed too, so show the emoji.
    const [failed, setFailed] = useState(null);
    const [trackedKey, setTrackedKey] = useState(placeKey);
    const [nearView, setNearView] = useState(false);
    const boxRef = useRef(null);

    // Reset lazily-fetched state when the place changes — render-phase, the
    // React-sanctioned "adjust state when a prop changes" pattern.
    if (placeKey !== trackedKey) {
        setTrackedKey(placeKey);
        setFetched(null);
        setFailed(null);
    }

    // A photo found earlier this session (e.g. before a tab switch) shows at
    // once, without waiting to scroll into view again.
    const known = !directSrc || failed ? peekPlaceImage(place)?.imageUrl || null : null;
    const src = (failed ? null : directSrc) || fetched || (failed === 'all' ? null : known);
    const needsLookup = !src && failed !== 'all' && !!place?.name && MAPS_ENABLED;

    // Only look up photos for thumbnails on or near the screen: a long
    // itinerary would otherwise fire a paid Places call for every stop at once.
    useEffect(() => {
        if (!needsLookup || nearView) return;
        const el = boxRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') { setNearView(true); return; }
        const io = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) { setNearView(true); io.disconnect(); }
        }, { root: scrollParent(el), rootMargin: '400px' });
        io.observe(el);
        return () => io.disconnect();
    }, [needsLookup, nearView]);

    // Lazily resolve a real photo when the place has none. fetchPlaceImage
    // caches per session and remembers place ids across reloads.
    useEffect(() => {
        if (!needsLookup || !nearView) return;
        let alive = true;
        fetchPlaceImage({
            name: place.name,
            googlePlaceId: place.googlePlaceId,
            lat: place.lat,
            lng: place.lng,
        }).then((res) => {
            if (alive && res?.imageUrl) setFetched(res.imageUrl);
        });
        return () => { alive = false; };
    }, [needsLookup, nearView, place?.name, place?.googlePlaceId, place?.lat, place?.lng]);

    const showImg = !!src;

    return (
        <div
            ref={boxRef}
            className={`place-thumb${className ? ' ' + className : ''}`}
            style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}
        >
            {showImg ? (
                <img
                    src={src}
                    alt={place?.name || ''}
                    loading="lazy"
                    decoding="async"
                    width={size}
                    height={size}
                    onError={() => setFailed(src === directSrc && !failed ? 'direct' : 'all')}
                />
            ) : (
                <span aria-hidden="true">{emojiFor(place?.category)}</span>
            )}
        </div>
    );
}
