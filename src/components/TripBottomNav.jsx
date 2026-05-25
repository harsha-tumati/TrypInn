// src/components/TripBottomNav.jsx
// Bottom tab bar shown on mobile. Capped at 5 slots — 4 primary tabs plus a
// "More" menu that reveals the overflow sections.
import { useState } from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { isTripClaimed } from '../utils/draftTrips';
import { Calendar, IndianRupee, MessageCircle, BarChart3, Sparkles, BookOpen, MoreHorizontal, Users } from 'lucide-react';

export default function TripBottomNav() {
    const { tripId } = useParams();
    const { places, selectedTrip } = useTrip();
    const { pathname } = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);

    // Expenses/Chat/Polls unlock only once the trip is claimed to a profile.
    const claimed = isTripClaimed(selectedTrip);
    const allTabs = [
        { to: '', icon: Sparkles, label: 'Plan', end: true },
        ...(places?.length > 0 ? [{ to: 'itinerary', icon: Calendar, label: 'Itinerary' }] : []),
        ...(claimed ? [
            { to: 'members', icon: Users, label: 'Members' },
            { to: 'expenses', icon: IndianRupee, label: 'Expenses' },
            { to: 'chat', icon: MessageCircle, label: 'Chat' },
            { to: 'polls', icon: BarChart3, label: 'Polls' },
        ] : []),
        { to: '/blog', icon: BookOpen, label: 'Blogs', absolute: true },
    ];

    const hrefFor = (t) => (t.absolute ? t.to : `/trip/${tripId}${t.to ? '/' + t.to : ''}`);

    // Max 5 slots. If everything fits, show it all; otherwise 4 tabs + "More".
    const fitsAll = allTabs.length <= 5;
    const primary = fitsAll ? allTabs : allTabs.slice(0, 4);
    const overflow = fitsAll ? [] : allTabs.slice(4);
    const moreActive = overflow.some((t) => pathname === hrefFor(t));

    return (
        <nav className="trip-bottom-nav" role="navigation" aria-label="Trip sections">
            {primary.map(({ to, icon: Icon, label, end, absolute }) => (
                <NavLink
                    key={label}
                    to={absolute ? to : `/trip/${tripId}${to ? '/' + to : ''}`}
                    end={end}
                    className={({ isActive }) => `trip-bottom-tab${isActive ? ' active' : ''}`}
                    aria-label={label}
                >
                    <Icon size={20} aria-hidden="true" />
                    <span>{label}</span>
                </NavLink>
            ))}

            {overflow.length > 0 && (
                <button
                    type="button"
                    className={`trip-bottom-tab${moreActive || moreOpen ? ' active' : ''}`}
                    onClick={() => setMoreOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                    aria-label="More sections"
                >
                    <MoreHorizontal size={20} aria-hidden="true" />
                    <span>More</span>
                </button>
            )}

            {moreOpen && overflow.length > 0 && (
                <>
                    <div className="trip-more-backdrop" onClick={() => setMoreOpen(false)} />
                    <div className="trip-more-sheet" role="menu">
                        {overflow.map(({ to, icon: Icon, label, end, absolute }) => (
                            <NavLink
                                key={label}
                                to={absolute ? to : `/trip/${tripId}${to ? '/' + to : ''}`}
                                end={end}
                                role="menuitem"
                                onClick={() => setMoreOpen(false)}
                                className={({ isActive }) => `trip-more-item${isActive ? ' active' : ''}`}
                            >
                                <Icon size={18} aria-hidden="true" />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </div>
                </>
            )}
        </nav>
    );
}
