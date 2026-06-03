// src/components/LocationAutocomplete.jsx
// A bordered location field with Google Places autocomplete when Maps is
// configured, and a graceful plain-text fallback when it isn't. The typed
// value always lives in `value`; a fully-resolved place (with coordinates)
// is delivered via `onSelect`.
import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, X, Check } from 'lucide-react';
import { MAPS_ENABLED } from '../config/maps';

export default function LocationAutocomplete({ value, onChange, onSelect, placeholder, id, autoFocus = false }) {
    const inputRef = useRef(null);
    const placesLib = useMapsLibrary('places');
    const acRef = useRef(null);
    const [confirmed, setConfirmed] = useState(false);

    // Keep the latest callbacks in refs so the one-time Autocomplete listener
    // always calls current props without being torn down on every render.
    const onChangeRef = useRef(onChange);
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
        onChangeRef.current = onChange;
        onSelectRef.current = onSelect;
    });

    useEffect(() => {
        const inputEl = inputRef.current;
        if (!placesLib || !inputEl || acRef.current) return;

        const ac = new placesLib.Autocomplete(inputEl, {
            fields: ['geometry', 'name', 'formatted_address', 'place_id'],
        });
        acRef.current = ac;

        const handlePlaceChanged = () => {
            const place = ac.getPlace();
            if (!place.geometry?.location) {
                // Typed text without picking a suggestion — leave unconfirmed.
                setConfirmed(false);
                onSelectRef.current?.(null);
                return;
            }
            const result = {
                name: place.name || place.formatted_address.split(',')[0],
                formatted: place.formatted_address,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                placeId: place.place_id,
            };
            setConfirmed(true);
            onSelectRef.current?.(result);
            onChangeRef.current?.(result.name);
        };

        ac.addListener('place_changed', handlePlaceChanged);

        const preventEnter = (e) => { if (e.key === 'Enter') e.preventDefault(); };
        inputEl.addEventListener('keydown', preventEnter);

        return () => { inputEl.removeEventListener('keydown', preventEnter); };
    }, [placesLib]);

    const handleChange = (e) => {
        const val = e.target.value;
        if (confirmed) {
            setConfirmed(false);
            onSelect?.(null);
        }
        onChange?.(val);
    };

    const clear = () => {
        setConfirmed(false);
        onChange?.('');
        onSelect?.(null);
        inputRef.current?.focus();
    };

    return (
        <div className="location-input-wrap">
            <Search size={16} className="location-input-icon" />
            <input
                id={id}
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoFocus={autoFocus}
                value={value || ''}
                onChange={handleChange}
                placeholder={placeholder}
                aria-label={placeholder}
                className={`location-input${confirmed ? ' location-confirmed' : ''}`}
                style={{ paddingRight: value ? 64 : 14 }}
            />
            {confirmed && (
                <span className="location-confirmed-icon" aria-label="Location confirmed">
                    <Check size={14} />
                </span>
            )}
            {value && (
                <button
                    type="button"
                    onClick={clear}
                    title="Clear location"
                    className="location-clear-btn"
                    tabIndex={-1}
                >
                    <X size={13} />
                </button>
            )}
        </div>
    );
}

// Convenience hint the parent can render when the user typed a place but Maps
// is unavailable, so coordinates couldn't be captured.
export const MAPS_FALLBACK_ACTIVE = !MAPS_ENABLED;
