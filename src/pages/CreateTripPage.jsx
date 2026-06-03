// src/pages/CreateTripPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip } from '../services/firestoreService';
import { addDraftId } from '../utils/draftTrips';
import { ArrowLeft, Search, X } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import MapsProvider from '../components/MapsProvider';
import usePageSeo from '../hooks/usePageSeo';

// ── Production-grade Google Places Autocomplete ──────────────────────────────
function LocationAutocomplete({ value, onChange, onSelect, placeholder, id }) {
    const inputRef = useRef(null);
    const placesLib = useMapsLibrary('places');
    const acRef = useRef(null);
    const [confirmed, setConfirmed] = useState(false);

    // Keep the latest callbacks in refs so the one-time Autocomplete listener
    // always calls the current props without being torn down each render.
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
                // User typed and hit enter without selecting — treat as unconfirmed text
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

        return () => {
            inputEl.removeEventListener('keydown', preventEnter);
            // Note: Google Maps listeners are cleaned up automatically when the map is destroyed
        };
    }, [placesLib]);

    const handleChange = (e) => {
        const val = e.target.value;
        if (confirmed) {
            setConfirmed(false);
            if (onSelect) onSelect(null);
        }
        if (onChange) onChange(val);
    };

    const clear = () => {
        setConfirmed(false);
        if (onChange) onChange('');
        if (onSelect) onSelect(null);
    };

    return (
        <div className="location-input-wrap">
            <Search size={16} className="location-input-icon" />
            <input
                id={id}
                ref={inputRef}
                type="text"
                autoComplete="off"
                value={value || ''}
                onChange={handleChange}
                placeholder={placeholder}
                className={`location-input${confirmed ? ' location-confirmed' : ''}`}
                style={{ paddingRight: value ? 40 : 14 }}
            />
            {value && (
                <button type="button" onClick={clear} title="Clear location" className="location-clear-btn">
                    <X size={14} />
                </button>
            )}
            {confirmed && (
                <div className="location-confirmed-badge">
                    <span>✓</span> Location confirmed
                </div>
            )}
        </div>
    );
}

// ── Inner form wrapped in APIProvider context ────────────────────────────────
function CreateTripForm() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', destination: '', description: '', startDate: null, endDate: null, budget: '' });
    const [startingPoint, setStartingPoint] = useState(null); // { name, lat, lng, placeId }
    const [endingPoint, setEndingPoint] = useState(null);
    const [startName, setStartName] = useState('');
    const [endName, setEndName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    function update(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

    async function handleCreate(e) {
        e.preventDefault();
        // Planning never requires login — the trip is created as an anonymous
        // draft and claimed to a profile later via "Add to my profile".
        if (!form.name.trim()) { setError('Please enter a trip name.'); return; }
        setLoading(true);
        setError('');
        try {
            // A confirmed place carries coordinates; otherwise keep the typed
            // text so the location survives even when Maps is unavailable.
            // Ending point falls back to the starting point when left blank.
            const resolvedStart = startingPoint || (startName.trim() ? { name: startName.trim() } : null);
            const resolvedEnd = endingPoint || (endName.trim() ? { name: endName.trim() } : null) || resolvedStart;
            const tripId = await createTrip({
                name: form.name.trim(),
                destination: form.destination.trim() || '',
                description: form.description.trim() || '',
                startDate: form.startDate ? form.startDate.toISOString().split('T')[0] : null,
                endDate: form.endDate ? form.endDate.toISOString().split('T')[0] : null,
                budget: form.budget || null,
                userId: null, // anonymous draft
                startingPoint: resolvedStart,
                endingPoint: resolvedEnd,
            });
            addDraftId(tripId);
            navigate(`/trip/${tripId}`);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page-container" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button className="btn btn-ghost" type="button" onClick={() => navigate(-1)} style={{ minWidth: 40, minHeight: 40 }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 className="page-title" style={{ margin: 0 }}>New Trip</h1>
            </div>

            <div className="glass-card-static" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Hero */}
                <div className="create-trip-hero" style={{ padding: isMobile ? '28px 20px' : '36px 24px' }}>
                    <span style={{ fontSize: isMobile ? 40 : 48 }}>🗺️</span>
                    <p style={{ fontSize: isMobile ? 16 : 18 }}>Where are you headed?</p>
                </div>

                <form onSubmit={handleCreate} style={{ padding: isMobile ? '20px 16px' : 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Trip Name */}
                    <div>
                        <label className="input-label" htmlFor="trip-name">Trip Name</label>
                        <input id="trip-name" className="input-field" placeholder="e.g. Goa Getaway 2025" value={form.name} onChange={e => update('name', e.target.value)} style={{ minHeight: 44 }} />
                    </div>

                    {/* Starting & Ending point */}
                    <div className="form-row">
                        <div>
                            <label className="input-label">Starting Point</label>
                            <LocationAutocomplete
                                id="start-point"
                                value={startName}
                                placeholder="Where are you leaving from?"
                                onChange={setStartName}
                                onSelect={p => { setStartingPoint(p); if (p) setStartName(p.name); }}
                            />
                        </div>
                        <div>
                            <label className="input-label">
                                Ending Point <span className="form-hint">(defaults to start)</span>
                            </label>
                            <LocationAutocomplete
                                id="end-point"
                                value={endName}
                                placeholder="Return to different place?"
                                onChange={setEndName}
                                onSelect={p => { setEndingPoint(p); if (p) setEndName(p.name); }}
                            />
                        </div>
                    </div>

                    {/* Destination / Route */}
                    <div>
                        <label className="input-label" htmlFor="trip-destination">
                            Destination / Route <span className="form-hint">(optional — add stops in the planner)</span>
                        </label>
                        <input id="trip-destination" className="input-field" placeholder="e.g. Goa, Puducherry — or leave blank" value={form.destination} onChange={e => update('destination', e.target.value)} style={{ minHeight: 44 }} />
                    </div>

                    {/* Description / Overview */}
                    <div>
                        <label className="input-label" htmlFor="trip-description">
                            Trip Overview <span className="form-hint">(optional)</span>
                        </label>
                        <textarea
                            id="trip-description"
                            className="input-field"
                            placeholder="Describe your trip plans, goals, or anything your group should know..."
                            value={form.description}
                            onChange={e => update('description', e.target.value)}
                            rows={3}
                            style={{ minHeight: 80, resize: 'vertical', fontSize: 16, padding: '12px 16px' }}
                        />
                    </div>

                    {/* Dates */}
                    <div className="form-row">
                        <div>
                            <label className="input-label">Start Date</label>
                            <DatePicker selected={form.startDate} onChange={date => update('startDate', date)}
                                selectsStart startDate={form.startDate} endDate={form.endDate} minDate={new Date()}
                                className="input-field" placeholderText="Select start date" dateFormat="MMM d, yyyy" />
                        </div>
                        <div>
                            <label className="input-label">End Date</label>
                            <DatePicker selected={form.endDate} onChange={date => update('endDate', date)}
                                selectsEnd startDate={form.startDate} endDate={form.endDate} minDate={form.startDate || new Date()}
                                className="input-field" placeholderText="Select end date" dateFormat="MMM d, yyyy" />
                        </div>
                    </div>

                    {/* Budget */}
                    <div>
                        <label className="input-label" htmlFor="trip-budget">Budget <span className="form-hint">(optional)</span></label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--color-primary-light)', fontWeight: 700, fontSize: 18 }}>₹</span>
                            <input id="trip-budget" className="input-field" type="number" placeholder="15000" value={form.budget} onChange={e => update('budget', e.target.value)} style={{ minHeight: 44, flex: 1 }} />
                        </div>
                    </div>

                    {/* Ending-point info banner */}
                    {startingPoint && !endingPoint && (
                        <div className="form-info-banner">
                            🔄 No ending point set — trip will return to <strong>{startingPoint.name}</strong>
                        </div>
                    )}

                    {error && <p className="form-error">{error}</p>}

                    <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4, minHeight: 48 }}>
                        {loading ? <div className="spinner spinner-sm"></div> : 'Start Planning →'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function CreateTripPage() {
    usePageSeo({ title: 'Create a Trip', robots: 'noindex, nofollow' });
    return (
        <MapsProvider>
            <CreateTripForm />
        </MapsProvider>
    );
}

