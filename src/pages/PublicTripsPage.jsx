// src/pages/PublicTripsPage.jsx
// Public Trips: every trip whose organiser listed it (Invite → "List on
// Public Trips") and that hasn't ended. Opening one shows the plan as a
// guest, with "Ask to join".
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { PublicTripsGrid, PublicTripsEmpty } from '../components/PublicTripsGrid';
import usePublicTrips from '../hooks/usePublicTrips';
import usePageSeo from '../hooks/usePageSeo';

export default function PublicTripsPage() {
    // User-made trips: listed for visitors, kept out of search engines.
    usePageSeo({ title: 'Public Trips', description: 'Trips travellers have opened up — ask to join and go together.', robots: 'noindex, follow' });
    const { trips, error } = usePublicTrips();
    const [query, setQuery] = useState('');

    const shown = useMemo(() => {
        if (!trips) return null;
        const q = query.trim().toLowerCase();
        if (!q) return trips;
        return trips.filter(t => [t.name, t.destination, ...(t.publicHighlights || [])]
            .some(v => (v || '').toLowerCase().includes(q)));
    }, [trips, query]);

    return (
        <div className="page-container pt-page">
            <header className="pt-header">
                <span className="hp-kicker"><UserPlus size={13} aria-hidden="true" /> Open trips</span>
                <h1 className="page-title">Public Trips</h1>
                <p className="page-subtitle">Trips travellers have opened up. Look through the plan, then ask to join — the organiser approves who comes along.</p>
                {trips && trips.length > 0 && (
                    <label className="pt-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by place or trip name"
                            aria-label="Search public trips"
                        />
                    </label>
                )}
            </header>

            <PublicTripsGrid trips={shown} />
            {trips && !trips.length && <PublicTripsEmpty error={error} />}
            {trips && trips.length > 0 && shown.length === 0 && (
                <p className="pt-nomatch">No public trips match “{query}”. <button type="button" onClick={() => setQuery('')}>Clear search</button></p>
            )}

            <p className="pt-foot">
                Want company on your own trip? <Link to="/">Plan it</Link>, then list it from <b>Invite</b>.
            </p>
        </div>
    );
}
