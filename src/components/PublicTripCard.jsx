// src/components/PublicTripCard.jsx
// A trip on Public Trips. Opens the trip as a guest, where the visitor can
// look through the plan and ask to join.
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, Route, UserRound } from 'lucide-react';
import TripCover from './TripCover';
import { formatDate } from '../utils/dateHelpers';

export default function PublicTripCard({ trip }) {
    const stops = trip.publicStopCount || 0;
    const highlights = trip.publicHighlights || [];
    return (
        <Link to={`/trip/${trip.id}`} className="hp-trip-card pt-card" aria-label={`${trip.name} — view trip and ask to join`}>
            <TripCover trip={trip}>
                <span className="pt-open-badge">Open to join</span>
            </TripCover>
            <div className="hp-trip-body">
                <h3>{trip.name}</h3>
                <div className="hp-trip-meta"><MapPin size={13} aria-hidden="true" /><span>{trip.destination || 'Somewhere amazing'}</span></div>
                {highlights.length > 0 && (
                    <ul className="pt-highlights" aria-label="Stops">
                        {highlights.map(h => <li key={h}>{h}</li>)}
                        {stops > highlights.length && <li className="pt-more">+{stops - highlights.length} more</li>}
                    </ul>
                )}
                <div className="hp-trip-foot">
                    <span className="hp-trip-date">
                        <Calendar size={13} aria-hidden="true" />
                        {trip.startDate ? `${formatDate(trip.startDate)}${trip.endDate ? ` – ${formatDate(trip.endDate)}` : ''}` : 'Dates flexible'}
                    </span>
                    <span className="hp-trip-open">View <ArrowRight size={13} aria-hidden="true" /></span>
                </div>
                <div className="pt-by">
                    <UserRound size={12} aria-hidden="true" /> {trip.organiserName || 'A Trypinn traveller'}
                    {stops > 0 && <><span aria-hidden="true">·</span><Route size={12} aria-hidden="true" /> {stops} stop{stops > 1 ? 's' : ''}</>}
                </div>
            </div>
        </Link>
    );
}
