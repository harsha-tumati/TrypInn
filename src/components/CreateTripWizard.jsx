// src/components/CreateTripWizard.jsx
// "Plan a trip", one question at a time: where to → when → starting from →
// name it → invite people now or later. Each step is a single big question
// with one answer, so nothing on screen competes for attention. Places
// picked in the homepage search arrive as `initialPlaces` in "Where to?".
//
// The trip is created on the last step. "Invite now" then shows its link to
// share before opening it; "Later" opens it straight away.
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X, MapPin, CalendarDays, Navigation, Pencil, Flag, UserPlus, Clock, Copy, Check, Share2, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { MAPS_ENABLED } from '../config/maps';
import { suggestGetawayName } from '../utils/tripName';
import { useIsMobile } from '../hooks/useIsMobile';

// Same rule as placeKind() in placesService, kept here so this step doesn't
// load the Places code just to label a chip.
const AREA_TYPES = ['locality', 'sublocality', 'sublocality_level_1', 'neighborhood', 'postal_town',
    'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3',
    'administrative_area_level_4', 'country', 'colloquial_area', 'archipelago', 'political'];
const isSpot = (p) => p.types?.length > 0 && !p.types.some((t) => AREA_TYPES.includes(t));

const LocationAutocomplete = lazy(() => import('./LocationAutocomplete'));
const DateRangeCalendar = lazy(() => import('./DateRangeCalendar'));

const STEPS = ['where', 'when', 'start', 'name', 'invite'];

const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
const fmtDay = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function dateSummary(start, end) {
    if (!start) return null;
    if (!end || sameDay(start, end)) return `${fmtDay(start)} · day trip`;
    const days = Math.round((end - start) / 86400000) + 1;
    return `${fmtDay(start)} – ${fmtDay(end)} · ${days} days, ${days - 1} night${days > 2 ? 's' : ''}`;
}

const fieldFallback = <div className="input-field" style={{ minHeight: 52 }} />;

// onCreate(answers) saves the trip and resolves to its id; onOpenTrip(id)
// takes the traveller into it.
export default function CreateTripWizard({ open, initialPlaces = [], onClose, onCreate, onOpenTrip }) {
    const isMobile = useIsMobile();
    const [step, setStep] = useState(0);
    const [places, setPlaces] = useState(initialPlaces);
    const [draft, setDraft] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [startName, setStartName] = useState('');
    const [startPoint, setStartPoint] = useState(null);
    const [differentEnd, setDifferentEnd] = useState(false);
    const [endName, setEndName] = useState('');
    const [endPoint, setEndPoint] = useState(null);
    const [name, setName] = useState('');
    const [budget, setBudget] = useState('');
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(null); // 'now' | 'later' while saving
    const [tripId, setTripId] = useState(null); // set once saved, for "Invite now"
    const [copied, setCopied] = useState(false);
    const [seed] = useState(() => Math.floor(Math.random() * 1000));
    const headingRef = useRef(null);

    // Once the trip exists, closing goes into it rather than dropping it.
    const close = () => (tripId ? onOpenTrip?.(tripId) : onClose?.());
    const closeRef = useRef(close);
    useEffect(() => { closeRef.current = close; });

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
        document.addEventListener('keydown', onKey);
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = original;
        };
    }, [open]);

    // Move focus to each new question, for keyboards and screen readers.
    // Steps with a search field focus that field themselves.
    useEffect(() => {
        if (open && (STEPS[step] === 'when')) headingRef.current?.focus();
    }, [open, step]);

    if (!open) return null;

    const key = STEPS[step];
    const spots = places.filter(isSpot);
    // Left blank, the name is made up: "Breezy Goa Getaway · 22 Oct".
    const suggestedName = suggestGetawayName({ destination: places[0]?.name, startingPoint: startName, startDate, seed });

    function addPlace(p) {
        if (!p?.name) return;
        const dup = places.some((q) => (p.placeId && q.placeId === p.placeId) || q.name.toLowerCase() === p.name.toLowerCase());
        if (!dup) setPlaces([...places, p]);
        setDraft('');
        setError('');
    }

    // Each step checks only its own answer.
    function next() {
        if (key === 'where') {
            const typed = draft.trim();
            if (!places.length && !typed) { setError('Pick where you’re headed.'); return; }
            if (typed) addPlace({ name: typed });
        }
        if (key === 'start') {
            if (!startName.trim()) { setError('Add where your trip starts.'); return; }
            if (differentEnd && !endName.trim()) { setError('Add where your trip ends, or untick “ends somewhere else”.'); return; }
        }
        setError('');
        if (step < STEPS.length - 1) setStep(step + 1);
    }

    function back() {
        setError('');
        if (step === 0) onClose?.();
        else setStep(step - 1);
    }

    async function finish(inviteNow) {
        setCreating(inviteNow ? 'now' : 'later');
        setError('');
        try {
            const id = await onCreate({
                places,
                startDate, endDate: endDate || startDate,
                start: startPoint || { name: startName.trim() },
                end: differentEnd ? (endPoint || { name: endName.trim() }) : null,
                name: name.trim() || suggestedName,
                budget: budget || null,
            });
            if (inviteNow) setTripId(id);
            else onOpenTrip?.(id);
        } catch (e) {
            setError(e.message || 'Could not create the trip. Try again.');
        } finally {
            setCreating(null);
        }
    }

    // A new trip is a draft: its plain link lets people open and edit it.
    const inviteUrl = tripId ? `${window.location.origin}/trip/${tripId}` : '';
    const inviteText = `Plan "${name.trim() || suggestedName}" with me on Trypinn: ${inviteUrl}`;
    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked — the field is selectable */ }
    };
    const shareLink = () => navigator.share?.({ title: name.trim() || suggestedName, text: inviteText.replace(`: ${inviteUrl}`, ''), url: inviteUrl }).catch(() => {});

    // Starting where you're headed (flying in, say) is one tap.
    const startHere = places.find((p) => p.lat != null && p.name.toLowerCase() !== startName.trim().toLowerCase());

    const content = (
        <div className="ctw-overlay" onClick={close} role="dialog" aria-modal="true" aria-labelledby="ctw-question">
            <form
                className="ctw-panel"
                onClick={(e) => e.stopPropagation()}
                onSubmit={(e) => { e.preventDefault(); next(); }}
            >
                <div className="ctw-top">
                    {tripId ? <span className="ctw-icon-spacer" /> : (
                        <button type="button" className="ctw-icon-btn" onClick={back} aria-label={step === 0 ? 'Close' : 'Back'} disabled={!!creating}>
                            {step === 0 ? <X size={18} /> : <ArrowLeft size={18} />}
                        </button>
                    )}
                    <div className="ctw-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
                        {STEPS.map((s, i) => <span key={s} className={i <= step ? 'is-done' : ''} />)}
                    </div>
                    {step > 0
                        ? <button type="button" className="ctw-icon-btn" onClick={close} aria-label="Close"><X size={18} /></button>
                        : <span className="ctw-icon-spacer" />}
                </div>

                <div className="ctw-body" key={key}>
                    <p className="ctw-step">Step {step + 1} of {STEPS.length}</p>

                    {key === 'where' && (
                        <>
                            <h2 id="ctw-question" className="ctw-question">Where to?</h2>
                            <p className="ctw-hint">A city, a region, or one place you want to see. Add more than one if you like.</p>
                            <Suspense fallback={fieldFallback}>
                                <LocationAutocomplete
                                    id="ctw-where"
                                    autoFocus={!isMobile}
                                    value={draft}
                                    onChange={(t) => { setDraft(t); if (t.trim()) setError(''); }}
                                    onSelect={(p) => p && addPlace(p)}
                                    clearOnSelect
                                    onEnterText={(t) => addPlace({ name: t })}
                                    placeholder={places.length ? 'Add another place' : 'e.g. Pondicherry, Kerala, Bali'}
                                    ariaLabel="Where are you going?"
                                />
                            </Suspense>
                            {places.length > 0 && (
                                <div className="place-chips ctw-chips">
                                    {places.map((p, i) => (
                                        <span key={p.placeId || `${p.name}-${i}`} className="place-chip">
                                            <MapPin size={12} aria-hidden="true" />
                                            <span className="place-chip-label">{p.name}</span>
                                            <span className="ctw-kind">{isSpot(p) ? 'Place' : 'Area'}</span>
                                            <button type="button" onClick={() => setPlaces(places.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {spots.length > 0 && (
                                <p className="ctw-note ctw-spot-note">
                                    {spots.length === 1
                                        ? `${spots[0].name} is a place, not an area. It goes straight into your plan as a stop.`
                                        : `${spots.map((p) => p.name).join(', ')} are places, not areas. They go straight into your plan as stops.`}
                                </p>
                            )}
                        </>
                    )}

                    {key === 'when' && (
                        <>
                            <h2 id="ctw-question" className="ctw-question" tabIndex={-1} ref={headingRef}>When are you going?</h2>
                            <p className="ctw-hint">Tap the first day, then the last.</p>
                            <div className="ctw-date-summary" aria-live="polite">
                                <CalendarDays size={16} aria-hidden="true" />
                                {dateSummary(startDate, endDate) || <span className="ctw-muted">No dates yet</span>}
                                {startDate && (
                                    <button type="button" className="ctw-link" onClick={() => { setStartDate(null); setEndDate(null); }}>Clear</button>
                                )}
                            </div>
                            <Suspense fallback={<div className="ctw-calendar" style={{ minHeight: 300 }} />}>
                                <DateRangeCalendar
                                    startDate={startDate}
                                    endDate={endDate}
                                    months={isMobile ? 1 : 2}
                                    onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                                />
                            </Suspense>
                        </>
                    )}

                    {key === 'start' && (
                        <>
                            <h2 id="ctw-question" className="ctw-question">Where are you starting from?</h2>
                            <p className="ctw-hint">Your home or where you land. The route and drive times start here.</p>
                            <Suspense fallback={fieldFallback}>
                                <LocationAutocomplete
                                    id="ctw-start"
                                    autoFocus={!isMobile}
                                    value={startName}
                                    placeholder="e.g. Chennai"
                                    ariaLabel="Where does your trip start?"
                                    onChange={(t) => { setStartName(t); if (t.trim()) setError(''); }}
                                    onSelect={(p) => { setStartPoint(p); if (p) setStartName(p.name); }}
                                    onEnterText={MAPS_ENABLED ? undefined : () => next()}
                                />
                            </Suspense>
                            {startHere && !startName.trim() && (
                                <button type="button" className="ctw-suggest" onClick={() => { setStartPoint(startHere); setStartName(startHere.name); setError(''); }}>
                                    <Navigation size={14} aria-hidden="true" /> I’ll start in {startHere.name}
                                </button>
                            )}
                            <label className="checkbox-row ctw-check">
                                <input type="checkbox" checked={differentEnd} onChange={(e) => setDifferentEnd(e.target.checked)} />
                                <span>My trip ends somewhere else</span>
                            </label>
                            {differentEnd ? (
                                <Suspense fallback={fieldFallback}>
                                    <LocationAutocomplete
                                        id="ctw-end"
                                        value={endName}
                                        placeholder="Where does it end?"
                                        ariaLabel="Where does your trip end?"
                                        onChange={(t) => { setEndName(t); if (t.trim()) setError(''); }}
                                        onSelect={(p) => { setEndPoint(p); if (p) setEndName(p.name); }}
                                    />
                                </Suspense>
                            ) : (
                                <p className="ctw-note">You’ll come back here at the end, like a round trip.</p>
                            )}
                        </>
                    )}

                    {key === 'name' && (
                        <>
                            <h2 id="ctw-question" className="ctw-question">Name your trip</h2>
                            <p className="ctw-hint">Leave it blank and we’ll call it “{suggestedName}”. You can change it later.</p>
                            <input
                                id="ctw-name"
                                type="text"
                                className="input-field ctw-input"
                                value={name}
                                maxLength={60}
                                placeholder={suggestedName}
                                aria-label="Trip name"
                                onChange={(e) => setName(e.target.value)}
                                autoFocus={!isMobile}
                            />
                            <label className="input-label ctw-budget-label" htmlFor="ctw-budget">
                                Budget <span className="input-label-hint">optional</span>
                            </label>
                            <div className="input-prefix-wrap">
                                <span className="input-prefix">₹</span>
                                <input id="ctw-budget" type="number" min="0" inputMode="numeric" className="input-field" placeholder="15,000" value={budget} onChange={(e) => setBudget(e.target.value)} />
                            </div>

                            <ul className="ctw-summary" aria-label="Your answers">
                                <li>
                                    <MapPin size={15} aria-hidden="true" />
                                    <span>{places.map((p) => p.name).join(', ')}</span>
                                    <button type="button" className="ctw-edit" onClick={() => setStep(0)} aria-label="Change where you’re going"><Pencil size={13} /></button>
                                </li>
                                <li>
                                    <CalendarDays size={15} aria-hidden="true" />
                                    <span>{dateSummary(startDate, endDate) || 'Dates not set'}</span>
                                    <button type="button" className="ctw-edit" onClick={() => setStep(1)} aria-label="Change dates"><Pencil size={13} /></button>
                                </li>
                                <li>
                                    <Flag size={15} aria-hidden="true" />
                                    <span>From {startName}{differentEnd && endName ? `, ending in ${endName}` : ', round trip'}</span>
                                    <button type="button" className="ctw-edit" onClick={() => setStep(2)} aria-label="Change start"><Pencil size={13} /></button>
                                </li>
                            </ul>
                        </>
                    )}

                    {key === 'invite' && !tripId && (
                        <>
                            <h2 id="ctw-question" className="ctw-question">Want to invite people now?</h2>
                            <p className="ctw-hint">Your group can add places, vote and chat in the trip with you.</p>
                            <div className="ctw-choices">
                                <button type="button" className="ctw-choice" onClick={() => finish(true)} disabled={!!creating}>
                                    <span className="ctw-choice-icon" aria-hidden="true"><UserPlus size={20} /></span>
                                    <span className="ctw-choice-text">
                                        <span className="ctw-choice-title">Invite now</span>
                                        <span className="ctw-choice-hint">Get a link to send your group</span>
                                    </span>
                                    {creating === 'now' && <span className="spinner spinner-sm" aria-label="Creating your trip" />}
                                </button>
                                <button type="button" className="ctw-choice" onClick={() => finish(false)} disabled={!!creating}>
                                    <span className="ctw-choice-icon" aria-hidden="true"><Clock size={20} /></span>
                                    <span className="ctw-choice-text">
                                        <span className="ctw-choice-title">Later</span>
                                        <span className="ctw-choice-hint">Invite anytime with the Invite button in your trip</span>
                                    </span>
                                    {creating === 'later' && <span className="spinner spinner-sm" aria-label="Creating your trip" />}
                                </button>
                            </div>
                        </>
                    )}

                    {key === 'invite' && tripId && (
                        <>
                            <h2 id="ctw-question" className="ctw-question">Send this link to your group</h2>
                            <p className="ctw-hint">Anyone with it can open the trip and plan with you. Save the trip to your profile later to approve who joins.</p>
                            <div className="share-link-row ctw-share-row">
                                <span className="share-link-icon" aria-hidden="true"><LinkIcon size={15} /></span>
                                <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} aria-label="Invite link" className="share-link-input" />
                            </div>
                            <div className="ctw-share-actions">
                                <button type="button" className="btn btn-ghost btn-md" onClick={copyLink}>
                                    {copied ? <><Check size={15} aria-hidden="true" /> Copied</> : <><Copy size={15} aria-hidden="true" /> Copy link</>}
                                </button>
                                <a className="btn btn-ghost btn-md" href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                                </a>
                                {typeof navigator !== 'undefined' && navigator.share && (
                                    <button type="button" className="btn btn-ghost btn-md" onClick={shareLink}>
                                        <Share2 size={15} aria-hidden="true" /> More
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {error && <p className="form-error ctw-error" role="alert">{error}</p>}
                </div>

                <div className="ctw-foot">
                    {key === 'invite' && tripId && (
                        <button type="button" className="btn btn-primary btn-md ctw-next" onClick={() => onOpenTrip?.(tripId)}>
                            Start planning
                        </button>
                    )}
                    {key !== 'invite' && key === 'when' && (
                        <button type="button" className="btn btn-ghost btn-md" onClick={() => { setStartDate(null); setEndDate(null); setError(''); setStep(step + 1); }}>
                            Not sure yet
                        </button>
                    )}
                    {key !== 'invite' && (
                        <button type="submit" className="btn btn-primary btn-md ctw-next" disabled={key === 'when' && !startDate}>
                            Continue
                        </button>
                    )}
                </div>
            </form>
        </div>
    );

    return createPortal(content, document.body);
}
