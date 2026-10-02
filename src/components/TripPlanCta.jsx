// src/components/TripPlanCta.jsx
// The "plan this trip" block at the end of a travel guide.
//
// Two actions, both backed by the pre-built plan for this blog's destination:
//   Get estimate      — opens a cost panel the reader can adjust
//   Generate itinerary — creates an anonymous trip seeded with the plan's places
//
// Collection plans (a roundup like "coolcations") carry several destinations,
// so the reader picks one first.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Sparkles, Clock, Users, Minus, Plus, Loader, MapPin } from 'lucide-react';
import { loadPlan, scaleEstimate, createTripFromPlan, formatInr } from '../services/tripPlans';

const MAX_DAYS = 21;
const MAX_PEOPLE = 12;

function Stepper({ icon: Icon, label, value, min, max, onChange, suffix }) {
    return (
        <div className="tp-stepper">
            <span className="tp-stepper-label"><Icon size={14} aria-hidden="true" /> {label}</span>
            <div className="tp-stepper-controls">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    disabled={value <= min}
                    aria-label={`Decrease ${label}`}
                >
                    <Minus size={15} />
                </button>
                <span className="tp-stepper-value" aria-live="polite">{value}{suffix}</span>
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, value + 1))}
                    disabled={value >= max}
                    aria-label={`Increase ${label}`}
                >
                    <Plus size={15} />
                </button>
            </div>
        </div>
    );
}

function EstimatePanel({ estimate, days, people, setDays, setPeople, tierKey, setTierKey }) {
    const scaled = scaleEstimate(estimate, days, people);
    const tier = scaled.tiers[tierKey];

    return (
        <div className="tp-estimate">
            <div className="tp-tiers" role="tablist" aria-label="Spending level">
                {Object.entries(scaled.tiers).map(([key, t]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={key === tierKey}
                        className={`tp-tier${key === tierKey ? ' is-active' : ''}`}
                        onClick={() => setTierKey(key)}
                    >
                        <span className="tp-tier-label">{t.label}</span>
                        <span className="tp-tier-total">{formatInr(t.tripTotal)}</span>
                    </button>
                ))}
            </div>

            <p className="tp-tier-blurb">{tier.blurb}</p>

            <div className="tp-steppers">
                <Stepper icon={Clock} label="Days" value={days} min={1} max={MAX_DAYS} onChange={setDays} />
                <Stepper icon={Users} label="Travellers" value={people} min={1} max={MAX_PEOPLE} onChange={setPeople} />
            </div>

            <ul className="tp-breakdown">
                {/* Split the trip total rather than scaling the stored per-day
                    figures: those are rounded individually, so multiplying them
                    up drifts a few hundred rupees away from the total below. */}
                {scaled.breakdown.map(part => (
                    <li key={part.key}>
                        <span>{part.label}</span>
                        <span>{formatInr(tier.tripTotal * part.share)}</span>
                    </li>
                ))}
                <li className="tp-breakdown-total">
                    <span>Total for {people} {people === 1 ? 'traveller' : 'travellers'}, {days} {days === 1 ? 'day' : 'days'}</span>
                    <span>{formatInr(tier.tripTotal)}</span>
                </li>
            </ul>

            <p className="tp-disclaimer">
                {formatInr(tier.perDayPerPerson)} per person per day.
                {scaled.approximate ? ' Based on a regional average — we don’t have specific data for this destination.' : ''}
                {' '}Excludes {scaled.excludes.join(', ').toLowerCase()}.
            </p>
        </div>
    );
}

export default function TripPlanCta({ planId, postTitle }) {
    const navigate = useNavigate();
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEstimate, setShowEstimate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    // For collection plans: which destination the reader picked.
    const [optionId, setOptionId] = useState(null);

    const [days, setDays] = useState(5);
    const [people, setPeople] = useState(2);
    const [tierKey, setTierKey] = useState('midRange');

    useEffect(() => {
        let alive = true;
        loadPlan(planId).then(p => {
            if (!alive) return;
            setPlan(p);
            setLoading(false);
            if (p?.kind === 'collection') setOptionId(p.options[0]?.id ?? null);
            else if (p?.suggestedDays) setDays(p.suggestedDays);
        });
        return () => { alive = false; };
    }, [planId]);

    // A collection's chosen option carries its own estimate and length.
    const selectedOption = plan?.kind === 'collection'
        ? plan.options.find(o => o.id === optionId) || plan.options[0]
        : null;
    const optionDays = selectedOption?.suggestedDays;

    // Adopt the option's suggested length when the reader switches
    // destination. Render-phase rather than an effect, so picking an option
    // costs one render instead of two.
    const [daysForOption, setDaysForOption] = useState(optionId);
    if (optionId !== daysForOption) {
        setDaysForOption(optionId);
        if (optionDays && optionDays !== days) setDays(optionDays);
    }

    const handleGenerate = useCallback(async () => {
        if (!plan) return;
        setCreating(true);
        setError('');
        try {
            // A collection's option is a pointer; the places live in the
            // destination plan, so fetch that before building the trip.
            const target = plan.kind === 'collection' ? await loadPlan(selectedOption.id) : plan;
            if (!target) throw new Error('That plan could not be loaded. Please try again.');
            const tripId = await createTripFromPlan({ plan: target, days, people, tierKey });
            navigate(`/trip/${tripId}`);
        } catch (e) {
            setError(e?.message || 'Something went wrong creating your trip.');
            setCreating(false);
        }
    }, [plan, selectedOption, days, people, tierKey, navigate]);

    if (loading) return null;
    if (!plan) return null;

    const estimate = selectedOption ? selectedOption.estimate : plan.estimate;
    const placeCount = selectedOption ? selectedOption.placeCount : plan.places.length;
    const destinationLabel = selectedOption ? selectedOption.title : plan.title;

    return (
        <section className="tp-cta" aria-label="Plan this trip">
            <div className="tp-cta-head">
                <h2>Plan this trip</h2>
                <p>
                    {plan.kind === 'collection'
                        ? plan.blurb
                        : `We’ve put together ${placeCount} places from this guide. Get a cost estimate, or drop them straight into an itinerary you can edit.`}
                </p>
            </div>

            {plan.kind === 'collection' && (
                <div className="tp-options" role="radiogroup" aria-label="Choose a destination">
                    {plan.options.map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={opt.id === optionId}
                            className={`tp-option${opt.id === optionId ? ' is-active' : ''}`}
                            onClick={() => setOptionId(opt.id)}
                        >
                            <span className="tp-option-name">{opt.title}</span>
                            <span className="tp-option-meta">{opt.placeCount} places · {opt.suggestedDays} days</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="tp-actions">
                <button
                    type="button"
                    className="tp-btn tp-btn-ghost"
                    onClick={() => setShowEstimate(v => !v)}
                    aria-expanded={showEstimate}
                >
                    <Calculator size={17} aria-hidden="true" />
                    {showEstimate ? 'Hide estimate' : 'Get estimate'}
                </button>
                <button
                    type="button"
                    className="tp-btn tp-btn-primary"
                    onClick={handleGenerate}
                    disabled={creating}
                >
                    {creating
                        ? <><Loader size={17} className="tp-spin" aria-hidden="true" /> Building your trip…</>
                        : <><Sparkles size={17} aria-hidden="true" /> Generate itinerary</>}
                </button>
            </div>

            {showEstimate && estimate && (
                <EstimatePanel
                    estimate={estimate}
                    days={days}
                    people={people}
                    setDays={setDays}
                    setPeople={setPeople}
                    tierKey={tierKey}
                    setTierKey={setTierKey}
                />
            )}

            {error && <p className="tp-error" role="alert">{error}</p>}

            <p className="tp-foot">
                <MapPin size={13} aria-hidden="true" />
                {' '}Creates a free trip for {destinationLabel} — no account needed. Invite people or save it to your profile later.
            </p>
            <span className="sr-only">Trip plan for {postTitle}</span>
        </section>
    );
}
