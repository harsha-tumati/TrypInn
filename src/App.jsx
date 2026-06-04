// src/App.jsx
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TripProvider, useTrip } from './context/TripContext';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import TripTopNav from './components/TripTopNav';
import TripBottomNav from './components/TripBottomNav';
// Eager (not lazy): InstallPrompt renders null until the beforeinstallprompt
// event, so it adds nothing to the initial paint — but a lazy Suspense boundary
// would not resolve during prerender and would trip React #419 on hydration.
import InstallPrompt from './components/InstallPrompt';

import TripsPage from './pages/TripsPage';
import MapsProvider from './components/MapsProvider';

// ── Lazy-loaded routes (code-split) ─────────────────────────────────
const LoginPage = lazy(() => import('./pages/LoginPage'));
const CreateTripPage = lazy(() => import('./pages/CreateTripPage'));
const PollsPage = lazy(() => import('./pages/PollsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ItineraryPage = lazy(() => import('./pages/ItineraryPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const JoinTripPage = lazy(() => import('./pages/JoinTripPage'));
const PlannerPage = lazy(() => import('./pages/PlannerPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const MustVisitsPage = lazy(() => import('./pages/MustVisitsPage'));

import { isTripClaimed } from './utils/draftTrips';

import { Users, LogIn, Loader } from 'lucide-react';
import { GuestModeProvider } from './context/GuestModeContext';

// ── Suspense fallback ────────────────────────────────────────────────
function RouteFallback() {
    return (
        <div role="status" aria-label="Loading page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div className="spinner" />
        </div>
    );
}

function GuestJoinBanner({ inviteCode }) {
    const { selectedTrip } = useTrip();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [, setSearchParams] = useSearchParams();
    const [joining, setJoining] = useState(false);
    const [done, setDone] = useState(false);

    if (done) return null;

    async function handleJoin() {
        if (!user) {
            navigate('/login', { state: { from: window.location.pathname + window.location.search } });
            return;
        }
        setJoining(true);
        try {
            const { joinTripByCode } = await import('./services/firestoreService');
            await joinTripByCode(inviteCode, user.uid);
            setDone(true);
            setSearchParams({}); // Clear query if present
        } catch (e) {
            if (import.meta.env.DEV) console.error(e);
        } finally {
            setJoining(false);
        }
    }

    return (
        <div style={{
            background: 'linear-gradient(90deg, #1E3A8A 0%, #3b5de7 100%)',
            color: '#fff', padding: '10px 20px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            zIndex: 50, flexShrink: 0,
        }}>
            <Users size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0 }}>
                You're viewing <strong>{selectedTrip?.name || 'this trip'}</strong> as a guest
                {!user && <span style={{ opacity: 0.8, fontWeight: 400 }}> — sign in to join and collaborate</span>}
            </span>
            <button type="button"
                onClick={handleJoin}
                disabled={joining}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#fff', color: '#1E3A8A',
                    border: 'none', borderRadius: 20, padding: '6px 16px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}
            >
                {joining ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={14} />}
                {user ? 'Join Trip' : 'Sign in to Join'}
            </button>
        </div>
    );
}

function TripLayout() {
    const { tripId } = useParams();
    const { selectedTrip, setSelectedTrip, members } = useTrip();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const inviteCodeParam = searchParams.get('invite');

    const claimed = isTripClaimed(selectedTrip);

    // Calculate if they are a guest
    let isGuest = false;
    if (claimed) {
        if (!user) {
            isGuest = true;
        } else {
            const userIsMember = members.some(m => m.uid === user.uid);
            // Wait for members to load before declaring them a guest, 
            // UNLESS they explicitly have an invite code in the URL.
            isGuest = !userIsMember && (members.length > 0 || !!inviteCodeParam);
        }
    }

    useEffect(() => {
        if (!selectedTrip || selectedTrip.id !== tripId) {
            // Load trip from Firestore if navigating directly
            async function loadTrip() {
                try {
                    const [{ db }, { doc, getDoc }] = await Promise.all([
                        import('./config/firebase'),
                        import('firebase/firestore'),
                    ]);
                    const tripSnap = await getDoc(doc(db, 'trips', tripId));
                    if (tripSnap.exists()) {
                        setSelectedTrip({ id: tripSnap.id, ...tripSnap.data() });
                    }
                } catch (e) {
                    if (import.meta.env.DEV) console.error('Failed to load trip:', e);
                }
            }
            loadTrip();
        }
    }, [tripId, selectedTrip, setSelectedTrip]);

    const activeInviteCode = inviteCodeParam || selectedTrip?.inviteCode;

    return (
        <GuestModeProvider isGuest={isGuest}>
            <div className="trip-layout-modern">
                <TripTopNav />
                {isGuest && activeInviteCode && <GuestJoinBanner inviteCode={activeInviteCode} />}
                <div className="trip-content-modern">
                    <Outlet />
                </div>
                <TripBottomNav />
            </div>
        </GuestModeProvider>
    );
}

// The map is no longer its own tab — it's a toggle inside the Plan screen.
// Keep old /trip/:id/map links working by redirecting them to the planner.
function MapRouteRedirect() {
    const { tripId } = useParams();
    return <Navigate to={`/trip/${tripId}`} replace />;
}

// Expenses, Chat and Polls are collaborative — they unlock only once a draft
// trip is claimed to a profile AND the user is logged in.
function ClaimedRoute() {
    const { tripId } = useParams();
    const { selectedTrip } = useTrip();
    const { user } = useAuth();
    const { pathname, search } = useLocation();

    // Trip not loaded yet (e.g. deep link) — wait rather than redirect early.
    if (!selectedTrip || selectedTrip.id !== tripId) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
            </div>
        );
    }
    if (!isTripClaimed(selectedTrip)) {
        return <Navigate to={`/trip/${tripId}/itinerary`} replace />;
    }
    return <Outlet />;
}

// Always open a freshly-navigated page from the top, not a stale scroll
// position. Container-scrolled pages remount on route change anyway; this
// covers window-scrolled (marketing) pages.
function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
    return null;
}

// SEO redirect: /blog/:postId → /travel-guides/:postId (preserves post slug)
function BlogRedirect() {
    const { postId } = useParams();
    return <Navigate to={`/travel-guides/${postId}`} replace />;
}

function AppRoutes() {
    return (
        <Suspense fallback={<RouteFallback />}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/join/:inviteCode" element={<JoinTripPage />} />

                <Route path="/" element={<><Navbar /><MapsProvider><main id="main-content"><TripsPage /></main></MapsProvider></>} />
                <Route path="/trips" element={<Navigate to="/" replace />} />
                <Route path="/trips/create" element={<><Navbar /><main id="main-content"><CreateTripPage /></main></>} />

                <Route path="/trip/:tripId" element={<TripLayout />}>
                    <Route index element={<main id="main-content"><PlannerPage /></main>} />
                    <Route path="map" element={<MapRouteRedirect />} />
                    <Route path="itinerary" element={<main id="main-content"><ItineraryPage /></main>} />
                    <Route element={<ClaimedRoute />}>
                        <Route path="polls" element={<main id="main-content"><PollsPage /></main>} />
                        <Route path="chat" element={<main id="main-content"><ChatPage /></main>} />
                        <Route path="expenses" element={<main id="main-content"><ExpensesPage /></main>} />
                        <Route path="members" element={<main id="main-content"><MembersPage /></main>} />
                    </Route>
                </Route>

                <Route path="/travel-guides" element={<><Navbar /><main id="main-content"><BlogPage /></main></>} />
                <Route path="/travel-guides/:postId" element={<><Navbar /><main id="main-content"><BlogPage /></main></>} />

                <Route path="/must-visits" element={<><Navbar /><main id="main-content"><MustVisitsPage /></main></>} />
                <Route path="/must-visits/:destination" element={<><Navbar /><main id="main-content"><MustVisitsPage /></main></>} />
                {/* SEO redirect: old /blog paths → /travel-guides */}
                <Route path="/blog" element={<Navigate to="/travel-guides" replace />} />
                <Route path="/blog/:postId" element={<BlogRedirect />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

function SkipLink() {
    return (
        <a
            href="#main-content"
            style={{
                position: 'absolute',
                top: -40,
                left: 0,
                background: '#1E3A8A',
                color: '#fff',
                padding: '8px 16px',
                zIndex: 100,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                borderRadius: '0 0 8px 0',
                transition: 'top 0.2s',
            }}
            onFocus={(e) => { e.currentTarget.style.top = 0; }}
            onBlur={(e) => { e.currentTarget.style.top = '-40px'; }}
        >
            Skip to main content
        </a>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <TripProvider>
                    <SkipLink />
                    <ScrollToTop />
                    <AppRoutes />
                    <InstallPrompt />
                </TripProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
