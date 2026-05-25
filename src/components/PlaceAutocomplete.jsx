// src/components/PlaceAutocomplete.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search } from 'lucide-react';

export default function PlaceAutocomplete({ onPlaceSelected, placeholder = "Search a place...", style, className }) {
    const inputRef = useRef(null);
    const placesLibrary = useMapsLibrary('places');
    const [autocomplete, setAutocomplete] = useState(null);

    useEffect(() => {
        if (!placesLibrary || !inputRef.current) return;

        const options = {
            fields: ['geometry', 'name', 'formatted_address', 'place_id', 'photos']
        };

        const autocompleteInstance = new placesLibrary.Autocomplete(inputRef.current, options);
        setAutocomplete(autocompleteInstance);

        // Don't submit the form when hitting enter on the autocomplete dropdown
        inputRef.current.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }, [placesLibrary]);

    useEffect(() => {
        if (!autocomplete) return;

        const listener = autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
                // User entered the name but didn't select a suggestion
                return;
            }

            const result = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                name: place.name || place.formatted_address.split(',')[0],
                formatted: place.formatted_address,
                placeId: place.place_id,
                imageUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
            };

            if (onPlaceSelected) {
                onPlaceSelected(result);
            }
            if (inputRef.current) {
                inputRef.current.value = ''; // clear after selection
            }
        });

        return () => {
            if (window.google && window.google.maps && window.google.maps.event) {
                window.google.maps.event.removeListener(listener);
            }
        };
    }, [autocomplete, onPlaceSelected]);

    return (
        <div style={{ position: 'relative', flex: 1, ...style }}>
            <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
                ref={inputRef}
                className={className || "input-field"}
                placeholder={placeholder}
                style={{ paddingLeft: 44, height: 48, fontSize: 16, width: '100%', background: 'transparent', border: 'none' }}
            />
        </div>
    );
}
