// src/components/PlaceThumb.jsx
// A consistent place thumbnail. Shows the real Google photo when available,
// lazily fetches one when it's missing, and falls back to a category emoji —
// never a misleading stock photo.
import { useState, useEffect } from 'react';
import { fetchPlaceImage } from '../services/placesService';
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

export default function PlaceThumb({ place, size = 60, radius = 12, className = '' }) {
    const directSrc = place?.imageUrl || place?.imageUrls?.[0] || null;
    const placeKey = place?.id ?? place?.name ?? '';
    const [fetched, setFetched] = useState(null);
    const [failed, setFailed] = useState(false);
    const [trackedKey, setTrackedKey] = useState(placeKey);

    // Reset lazily-fetched state when the place changes — render-phase, the
    // React-sanctioned "adjust state when a prop changes" pattern.
    if (placeKey !== trackedKey) {
        setTrackedKey(placeKey);
        setFetched(null);
        setFailed(false);
    }

    const src = directSrc || fetched;

    // Lazily resolve a real photo when the place has none. fetchPlaceImage
    // loads the Places library on demand, so no readiness polling is needed.
    useEffect(() => {
        if (src || !place?.name || !MAPS_ENABLED) return;
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
    }, [src, place?.name, place?.googlePlaceId, place?.lat, place?.lng]);

    const showImg = src && !failed;

    return (
        <div
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
                    onError={() => setFailed(true)}
                />
            ) : (
                <span aria-hidden="true">{emojiFor(place?.category)}</span>
            )}
        </div>
    );
}
