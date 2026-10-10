// src/components/EstimatePanel.jsx
// Trip cost estimate: three spending tiers, adjustable days and party size,
// and a breakdown that always sums to the total shown. Shared by the
// itinerary card and the destination plan card.
import { Clock, Users, Minus, Plus } from 'lucide-react';
import { scaleEstimate, formatInr } from '../services/tripPlans';

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

export default function EstimatePanel({ estimate, days, people, setDays, setPeople, tierKey, setTierKey }) {
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
