// src/components/LocationAutocomplete.jsx
// A bordered location field with place suggestions. The typed value always
// lives in `value`; a fully-resolved place (with coordinates) is delivered via
// `onSelect`.
//
// Suggestions come straight from the Places API (see autocompletePlaces), so
// they start appearing before the Maps script has even loaded, and they're
// drawn in our own list directly under the field. (Google's ready-made widget
// waited for the whole Maps library, debounced every keystroke, and floated
// its list loose on the page, so it drifted away when a modal scrolled.)
import React, { useEffect, useId, useRef, useState } from 'react';
import { Search, X, Check, MapPin, Loader } from 'lucide-react';
import { MAPS_ENABLED } from '../config/maps';

const DEBOUNCE_MS = 90;

// clearOnSelect: for multi-pick fields (PlacesPicker) — empty the field after
//   each pick instead of showing the picked name as confirmed.
// onEnterText: called with the typed text when Enter is pressed and there's no
//   suggestion to pick (e.g. no Maps key configured).
export default function LocationAutocomplete({ value, onChange, onSelect, placeholder, id, autoFocus = false, clearOnSelect = false, onEnterText, ariaLabel }) {
    const listId = useId();
    const inputRef = useRef(null);
    const [confirmed, setConfirmed] = useState(false);
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [resolving, setResolving] = useState(false);
    const sessionRef = useRef(null);
    const reqRef = useRef(0);
    const timerRef = useRef(null);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const search = (text) => {
        clearTimeout(timerRef.current);
        const q = text.trim();
        if (!MAPS_ENABLED || !q) { setItems([]); setOpen(false); setLoading(false); return; }
        setLoading(true);
        const req = ++reqRef.current;
        timerRef.current = setTimeout(async () => {
            try {
                const { autocompletePlaces, newPlacesSessionToken } = await import('../services/placesService');
                if (!sessionRef.current) sessionRef.current = newPlacesSessionToken();
                const found = await autocompletePlaces(q, sessionRef.current);
                if (req !== reqRef.current) return; // a newer keystroke won
                setItems(found.slice(0, 6));
                setActive(found.length ? 0 : -1);
                setOpen(true);
            } catch (e) {
                if (req === reqRef.current) { setItems([]); setOpen(false); }
                console.error('Location search failed', e);
            } finally {
                if (req === reqRef.current) setLoading(false);
            }
        }, DEBOUNCE_MS);
    };

    const handleChange = (e) => {
        const val = e.target.value;
        if (confirmed) {
            setConfirmed(false);
            onSelect?.(null);
        }
        onChange?.(val);
        search(val);
    };

    const pick = async (item) => {
        if (!item) return;
        setOpen(false);
        setItems([]);
        onChange?.(item.main);
        setResolving(true);
        try {
            const { resolvePlace } = await import('../services/placesService');
            const place = await resolvePlace(item.placeId, sessionRef.current);
            const result = { ...place, name: item.main || place.name, formatted: place.formatted || [item.main, item.secondary].filter(Boolean).join(', ') };
            onSelect?.(result);
            if (clearOnSelect) {
                onChange?.('');
            } else {
                setConfirmed(true);
                onChange?.(result.name);
            }
        } catch (e) {
            console.error('Could not resolve the place', e);
            setConfirmed(false);
            onSelect?.(null);
        } finally {
            sessionRef.current = null; // the pick ends this search session
            setResolving(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown' && items.length) {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % items.length);
        } else if (e.key === 'ArrowUp' && items.length) {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault(); // never submit the surrounding form mid-search
            if (open && items[active]) pick(items[active]);
            else if (onEnterText && (value || '').trim()) onEnterText(value.trim());
        } else if (e.key === 'Escape' && open) {
            e.stopPropagation(); // close the list, not the modal
            setOpen(false);
        }
    };

    const clear = () => {
        clearTimeout(timerRef.current);
        reqRef.current++;
        setConfirmed(false);
        setItems([]);
        setOpen(false);
        setLoading(false);
        onChange?.('');
        onSelect?.(null);
        inputRef.current?.focus();
    };

    const showList = open && items.length > 0;

    return (
        <div className="location-input-wrap">
            <Search size={16} className="location-input-icon" />
            <input
                id={id}
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                autoFocus={autoFocus}
                value={value || ''}
                onChange={handleChange}
                onKeyDown={onKeyDown}
                onFocus={() => { if (items.length && !confirmed) setOpen(true); }}
                onBlur={() => setOpen(false)}
                placeholder={placeholder}
                aria-label={ariaLabel || placeholder}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={listId}
                aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
                className={`location-input${confirmed ? ' location-confirmed' : ''}`}
                style={{ paddingRight: value ? 64 : 14 }}
            />
            {(loading || resolving) && !confirmed && (
                <span className="location-input-loading" aria-hidden="true"><Loader size={14} /></span>
            )}
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
            {showList && (
                <ul id={listId} className="location-input-ac-list" role="listbox">
                    {items.map((item, i) => (
                        <li
                            key={item.placeId}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            className={`location-input-ac-item${i === active ? ' is-active' : ''}`}
                            // Keep focus in the field (so blur doesn't close the list
                            // first), then pick on click — a scroll gesture on a
                            // phone never becomes a click, so it can't pick by mistake.
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => pick(item)}
                            onMouseEnter={() => setActive(i)}
                        >
                            <MapPin size={15} aria-hidden="true" className="location-input-ac-pin" />
                            <span className="location-input-ac-text">
                                <span className="location-input-ac-main">{item.main}</span>
                                {item.secondary && <span className="location-input-ac-sub">{item.secondary}</span>}
                            </span>
                        </li>
                    ))}
                    <li className="location-input-ac-attr" aria-hidden="true">Powered by Google</li>
                </ul>
            )}
        </div>
    );
}

// Convenience hint the parent can render when the user typed a place but Maps
// is unavailable, so coordinates couldn't be captured.
export const MAPS_FALLBACK_ACTIVE = !MAPS_ENABLED;
