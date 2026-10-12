// src/components/PlacesPicker.jsx
// Multi-place picker (the homepage search). Each pick is added as a chip.
// Suggestions come from LocationAutocomplete, so they're fast and the list is
// anchored under the field. Without a Maps key, type a place and press Enter.
import React, { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { MAPS_ENABLED } from '../config/maps';
import LocationAutocomplete from './LocationAutocomplete';

export default function PlacesPicker({ places, onChange, id, autoFocus = false }) {
    const [draft, setDraft] = useState('');

    // Add a place unless it's already in the list (by id, else by name).
    function addPlace(place) {
        if (!place?.name) return;
        const dup = places.some((p) =>
            (place.placeId && p.placeId === place.placeId) ||
            p.name.toLowerCase() === place.name.toLowerCase()
        );
        if (!dup) onChange([...places, place]);
        setDraft('');
    }

    function removePlace(idx) {
        onChange(places.filter((_, i) => i !== idx));
    }

    return (
        <div>
            <LocationAutocomplete
                id={id}
                autoFocus={autoFocus}
                value={draft}
                onChange={setDraft}
                onSelect={(p) => p && addPlace(p)}
                clearOnSelect
                // No Maps key: Enter commits the typed text as a coordinate-less
                // place (hasCoords() guards downstream keep this safe).
                onEnterText={MAPS_ENABLED ? undefined : (text) => addPlace({ name: text })}
                placeholder={MAPS_ENABLED ? 'Search a place to add…' : 'Type a place, press Enter to add'}
                ariaLabel={MAPS_ENABLED ? 'Search a place to add' : 'Type a place and press Enter to add'}
            />
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
