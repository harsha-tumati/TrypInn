// src/components/PlacesPicker.jsx
// Multi-place picker for the "Plan a trip" popup. With a Google Maps key it
// shows a live Places autocomplete dropdown; each pick is added as a chip.
// Without a key it degrades gracefully: type a place name and press Enter.
import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, X, MapPin } from 'lucide-react';
import { MAPS_ENABLED } from '../config/maps';

export default function PlacesPicker({ places, onChange, id, autoFocus = false }) {
    const inputRef = useRef(null);
    const placesLib = useMapsLibrary('places');
    const acRef = useRef(null);
    const [draft, setDraft] = useState('');

    // The Google 'place_changed' listener is registered once, so it must read
    // current props/state through refs instead of a stale render closure.
    const placesRef = useRef(places);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        placesRef.current = places;
        onChangeRef.current = onChange;
    });

    // Add a place unless it's already in the list (by id, else by name).
    function addPlace(place) {
        const list = placesRef.current;
        const dup = list.some((p) =>
            (place.placeId && p.placeId === place.placeId) ||
            p.name.toLowerCase() === place.name.toLowerCase()
        );
        if (dup) return;
        onChangeRef.current([...list, place]);
    }

    useEffect(() => {
        const inputEl = inputRef.current;
        if (!placesLib || !inputEl || acRef.current) return;

        const ac = new placesLib.Autocomplete(inputEl, {
            fields: ['geometry', 'name', 'formatted_address', 'place_id'],
        });
        acRef.current = ac;

        ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place.geometry?.location) return; // typed text, no suggestion picked
            addPlace({
                name: place.name || place.formatted_address.split(',')[0],
                formatted: place.formatted_address || '',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                placeId: place.place_id || null,
            });
            setDraft('');
            inputEl.value = '';
        });

        // Enter must not submit the surrounding form while choosing a suggestion.
        const preventEnter = (e) => { if (e.key === 'Enter') e.preventDefault(); };
        inputEl.addEventListener('keydown', preventEnter);
        return () => inputEl.removeEventListener('keydown', preventEnter);
    }, [placesLib]);

    // Fallback path (no Maps key): Enter commits the typed text as a
    // coordinate-less place. hasCoords() guards downstream keep this safe.
    function handleKeyDown(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (MAPS_ENABLED) return; // live autocomplete owns selection
        const val = draft.trim();
        if (!val) return;
        addPlace({ name: val });
        setDraft('');
    }

    function removePlace(idx) {
        onChange(places.filter((_, i) => i !== idx));
    }

    return (
        <div>
            <div className="location-input-wrap">
                <Search size={16} className="location-input-icon" />
                <input
                    id={id}
                    ref={inputRef}
                    type="text"
                    autoComplete="off"
                    autoFocus={autoFocus}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={MAPS_ENABLED ? 'Search a place to add…' : 'Type a place, press Enter to add'}
                    aria-label={MAPS_ENABLED ? 'Search a place to add' : 'Type a place and press Enter to add'}
                    className="location-input"
                />
            </div>
            {places.length > 0 && (
                <div className="place-chips">
                    {places.map((p, i) => (
                        <span key={p.placeId || `${p.name}-${i}`} className="place-chip">
                            <MapPin size={12} aria-hidden="true" />
                            <span className="place-chip-label">{p.name}</span>
                            <button type="button" onClick={() => removePlace(i)} aria-label={`Remove ${p.name}`}>
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
