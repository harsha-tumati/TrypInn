// src/components/Navbar.jsx — floating glass-pill top bar
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, BookOpen, Plus, LogIn, MapPin, Globe } from 'lucide-react';
import BrandMark from './BrandMark';

export default function Navbar() {
    const { user, userProfile, loading, signOut } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [showDropdown, setShowDropdown] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // The floating pill tightens up a touch once the page is scrolled.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    async function handleSignOut() {
        await signOut();
        navigate('/login');
    }

    return (
        <nav className={`navbar${scrolled ? ' navbar-scrolled' : ''}`} aria-label="Primary">
            <Link to="/" className="navbar-brand" aria-label="Trypinn home">
                <span className="navbar-brand-icon" aria-hidden="true"><BrandMark size={26} /></span>
                <span className="navbar-brand-name">trypinn</span>
            </Link>

            <div className="navbar-actions">
                {user && (
                    <a
                        href="/#my-trips-section"
                        className="navbar-link"
                        aria-label="My trips"
                        onClick={(e) => {
                            if (pathname === '/') {
                                e.preventDefault();
                                document.getElementById('my-trips-section')?.scrollIntoView({ behavior: 'smooth' });
                            }
                        }}
                    >
                        <MapPin size={15} aria-hidden="true" />
                        <span className="navbar-link-label">My trips</span>
                    </a>
                )}

                <NavLink
                    to="/public-trips"
                    className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
                    aria-label="Public Trips"
                >
                    <Globe size={15} aria-hidden="true" />
                    <span className="navbar-link-label">Public Trips</span>
                </NavLink>

                <NavLink
                    to="/travel-guides"
                    className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
                    aria-label="Travel Guides"
                >
                    <BookOpen size={15} aria-hidden="true" />
                    <span className="navbar-link-label">Travel Guides</span>
                </NavLink>

                <button type="button" className="navbar-cta" aria-label="Plan a trip" onClick={() => navigate('/', { state: { openPlanModal: true } })}>
                    <Plus size={16} aria-hidden="true" />
                    <span className="navbar-cta-label">Plan a trip</span>
                </button>

                {loading ? null : user ? (
                    <div className="navbar-profile" ref={dropdownRef}>
                        <button
                            type="button"
                            className="navbar-avatar"
                            onClick={() => setShowDropdown(v => !v)}
                            title={userProfile?.name || 'User'}
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
                                <div className="profile-dropdown-divider"></div>
                                <button type="button" className="profile-signout-btn" onClick={handleSignOut} role="menuitem">
                                    <LogOut size={16} aria-hidden="true" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        className="navbar-login"
                        onClick={() => navigate('/login', { state: { from: pathname } })}
                        aria-label="Log in"
                    >
                        <LogIn size={17} aria-hidden="true" />
                        <span className="navbar-login-label">Log in</span>
                    </button>
                )}
            </div>
        </nav>
    );
}
