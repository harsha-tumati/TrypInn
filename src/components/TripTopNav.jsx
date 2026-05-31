// src/components/TripTopNav.jsx — Unified single-row trip nav
import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Calendar, IndianRupee, MessageCircle, ArrowLeft, BarChart3, LogOut, LogIn, Sparkles, UserPlus, Check, Users } from 'lucide-react';
import { isTripClaimed } from '../utils/draftTrips';
import BrandMark from './BrandMark';

export default function TripTopNav() {
    const { tripId } = useParams();
    const { selectedTrip, places } = useTrip();
    const { user, userProfile, loading, signOut } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [copied, setCopied] = useState(false);
    const handleInvite = () => {
        if (!selectedTrip?.inviteCode) return;
        const shareUrl = `${window.location.origin}/join/${selectedTrip.inviteCode}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Map is intentionally not a tab — it's a floating toggle inside the
    // Plan and Itinerary screens (see MapToggleButton).
    // Expenses, Chat and Polls are collaborative — they appear only once the
    // trip is claimed to a profile ("Add to my profile" on the itinerary).
    const claimed = isTripClaimed(selectedTrip);
    const tabs = [
        { to: '', icon: Sparkles, label: 'Plan', end: true },
        ...(places?.length > 0 ? [{ to: 'itinerary', icon: Calendar, label: 'Itinerary' }] : []),
        ...(claimed ? [
            { to: 'members', icon: Users, label: 'Members' },
            { to: 'expenses', icon: IndianRupee, label: 'Expenses' },
            { to: 'chat', icon: MessageCircle, label: 'Chat' },
            { to: 'polls', icon: BarChart3, label: 'Polls' },
        ] : []),
    ];

    return (
        <div className="trip-top-nav-unified" role="navigation" aria-label="Trip workspace">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 0 }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }} aria-label="Trypinn home">
                    <div className="navbar-brand-icon" style={{ width: 34, height: 34, borderRadius: 11 }} aria-hidden="true"><BrandMark size={19} /></div>
                </Link>
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    style={{
                        background: 'rgba(17, 19, 30, 0.04)',
                        border: '1px solid var(--line)',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '7px',
                        borderRadius: 11,
                        flexShrink: 0,
                        transition: 'background var(--transition-fast), color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(17, 19, 30, 0.09)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(17, 19, 30, 0.04)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                    aria-label="Back to all trips"
                    title="Back to trips"
                >
                    <ArrowLeft size={16} />
                </button>
                <span className="trip-title-header" style={{ maxWidth: 160 }}>
                    {selectedTrip?.name || 'Loading…'}
                </span>
            </div>

            <div className="trip-pill-tabs" role="tablist">
                {tabs.map(({ to, icon: Icon, label, end, absolute }) => (
                    <NavLink
                        key={label}
                        to={absolute ? to : `/trip/${tripId}${to ? '/' + to : ''}`}
                        end={end}
                        className={({ isActive }) => `trip-pill-tab${isActive ? ' active' : ''}`}
                        aria-label={label}
                    >
                        <Icon size={15} aria-hidden="true" />
                        <span className="trip-tab-label">{label}</span>
                    </NavLink>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {selectedTrip?.inviteCode && (
                    <button
                        type="button"
                        onClick={handleInvite}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: copied ? '#d1fae5' : '#EEF3FC',
                            color: copied ? '#059669' : '#1E3A8A',
                            border: `1px solid ${copied ? '#34d399' : '#BFD0F0'}`,
                            padding: '6px 12px',
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        aria-label="Invite friends to trip"
                    >
                        {copied ? <Check size={14} /> : <UserPlus size={14} />}
                        {copied ? 'Copied' : 'Invite'}
                    </button>
                )}
                {loading ? (
                    <div style={{ width: 34, height: 34 }} aria-hidden="true" />
                ) : user ? (
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className="navbar-avatar"
                            onClick={() => setShowDropdown(v => !v)}
                            title={userProfile?.name || 'User'}
                            style={{ width: 34, height: 34, fontSize: 12 }}
                            aria-haspopup="menu"
                            aria-expanded={showDropdown}
                            aria-label={`Account menu for ${userProfile?.name || 'user'}`}
                        >
                            {userProfile?.name?.[0]?.toUpperCase() || 'U'}
                        </button>
                        {showDropdown && (
                            <div className="profile-dropdown" role="menu">
                                <div className="profile-dropdown-header">
                                    <div className="profile-dropdown-name">{userProfile?.name || 'Traveler'}</div>
                                    <div className="profile-dropdown-email">{userProfile?.email || ''}</div>
                                </div>
                                <div className="profile-dropdown-divider" />
                                <button
                                    className="profile-signout-btn"
                                    onClick={async () => { await signOut(); navigate('/login'); }}
                                    role="menuitem"
                                >
                                    <LogOut size={16} aria-hidden="true" /><span>Sign Out</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        className="trip-login-btn"
                        onClick={() => navigate('/login', { state: { from: pathname } })}
                        aria-label="Log in"
                    >
                        <LogIn size={15} aria-hidden="true" />
                        <span className="trip-login-label">Log in</span>
                    </button>
                )}
            </div>
        </div>
    );
}
