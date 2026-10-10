// src/components/ItineraryCard.jsx
// "Suggested itinerary" card, placed inside a travel guide at the end of the
// section where the article lays out its route.
//
// Shows the trip day by day, then two actions:
//   Plan & view this trip — creates a draft trip with every stop already
//                           pinned and opens the planner on it
//   Get estimate          — the shared cost panel, sized to this trip
//
// Posts that describe more than one trip (Vietnam north vs south, Montenegro
// vs Slovenia, Kashmir/Spiti/Sikkim) get a switcher above the route.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Calculator, Loader, MapPin, Route } from 'lucide-react';
import EstimatePanel from './EstimatePanel';
import { createTripFromItinerary, dayLabel, scaleEstimate } from '../services/tripPlans';

export default function ItineraryCard({ itinerary }) {
    const navigate = useNavigate();
    const options = itinerary.options;
    const [optionId, setOptionId] = useState(options[0].id);
    const option = options.find(o => o.id === optionId) || options[0];

    const [showEstimate, setShowEstimate] = useState(false);
    const [days, setDays] = useState(option.estimate.days);
    const [people, setPeople] = useState(2);
    const [tierKey, setTierKey] = useState('midRange');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    function pick(id) {
        const next = options.find(o => o.id === id);
        setOptionId(id);
        setDays(next.estimate.days);
    }

    async function planTrip() {
        setCreating(true);
        setError('');
        try {
            const scaled = scaleEstimate(option.estimate, days, people);
            const tripId = await createTripFromItinerary({
                option,
                budget: scaled?.tiers?.[tierKey]?.tripTotal ?? null,
            });
            navigate(`/trip/${tripId}`);
        } catch (e) {
            setError(e?.message || 'Could not create the trip. Please try again.');
            setCreating(false);
        }
    }

    const stopCount = option.legs.reduce((n, l) => n + l.stops.length, 0);
    const lengthLabel = option.days ? `${option.days} days` : 'Route';

    return (
        <section className="itin-card" aria-label={`Suggested itinerary: ${option.title}`}>
            <div className="itin-head">
                <span className="itin-kicker"><Route size={14} aria-hidden="true" /> Suggested itinerary</span>
                <h3 className="itin-title">{option.title}</h3>
                <p className="itin-meta">
                    {lengthLabel} · {stopCount} stops · {option.countries.join(' & ')}
                </p>
            </div>

            {options.length > 1 && (
                <div className="itin-options" role="tablist" aria-label="Choose a route">
                    {options.map(o => (
                        <button
                            key={o.id}
                            type="button"
                            role="tab"
                            aria-selected={o.id === option.id}
                            className={`itin-option${o.id === option.id ? ' is-active' : ''}`}
                            onClick={() => pick(o.id)}
                        >
                            {o.title}
                            {o.days ? <span className="itin-option-days">{o.days}d</span> : null}
                        </button>
                    ))}
                </div>
            )}

            <ol className="itin-legs">
                {option.legs.map((leg, i) => (
                    <li key={i} className={`itin-leg${leg.travel ? ' is-travel' : ''}`}>
                        <span className="itin-day">{dayLabel(leg.days) || `Stop ${i + 1}`}</span>
                        <div className="itin-leg-body">
                            <span className="itin-base">
                                {leg.travel && <ArrowRight size={13} aria-hidden="true" />} {leg.base}
                            </span>
                            {leg.stops.length > 0 && (
                                <span className="itin-stops">{leg.stops.map(s => s.name).join(' · ')}</span>
                            )}
                            {leg.note && <span className="itin-note">{leg.note}</span>}
                        </div>
                    </li>
                ))}
            </ol>

            {option.note && <p className="itin-option-note">{option.note}</p>}

            <div className="tp-actions">
                <button type="button" className="tp-btn tp-btn-primary" onClick={planTrip} disabled={creating}>
                    {creating
                        ? <><Loader size={17} className="tp-spin" aria-hidden="true" /> Building your trip…</>
                        : <><MapPin size={17} aria-hidden="true" /> Plan &amp; view this trip</>}
                </button>
                <button
                    type="button"
                    className="tp-btn tp-btn-ghost"
                    onClick={() => setShowEstimate(v => !v)}
                    aria-expanded={showEstimate}
                >
                    <Calculator size={17} aria-hidden="true" />
                    {showEstimate ? 'Hide estimate' : 'Get estimate'}
                </button>
            </div>

            {showEstimate && (
                <EstimatePanel
                    estimate={option.estimate}
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
                Opens the planner with all {stopCount} stops on the map, as a free draft trip — no account needed.
            </p>
        </section>
    );
}
