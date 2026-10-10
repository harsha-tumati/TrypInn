// src/components/PublicTripsGrid.jsx
// The grid of public trip cards (with a loading state), and the message shown
// when none are listed. Used on the home page and the Public Trips tab.
import { Globe } from 'lucide-react';
import PublicTripCard from './PublicTripCard';

export function PublicTripsGrid({ trips, limit }) {
    if (trips === null) {
        return (
            <div className="hp-trips-grid" aria-busy="true" aria-label="Loading public trips">
                {Array.from({ length: Math.min(limit || 3, 3) }, (_, i) => <div key={i} className="pt-skeleton" />)}
            </div>
        );
    }
    if (!trips.length) return null;
    return (
        <div className="hp-trips-grid">
            {(limit ? trips.slice(0, limit) : trips).map(t => <PublicTripCard key={t.id} trip={t} />)}
        </div>
    );
}

export function PublicTripsEmpty({ error }) {
    return (
        <div className="pt-empty">
            <Globe size={28} aria-hidden="true" />
            <strong>{error ? 'Couldn’t load public trips right now.' : 'No public trips right now.'}</strong>
            <span>
                {error
                    ? 'Please try again in a moment.'
                    : <>Planning one? Open it, tap <b>Invite</b> and switch on <b>List on Public Trips</b> — travellers can then find it and ask to join.</>}
            </span>
        </div>
    );
}
