// src/App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TripProvider, useTrip } from './context/TripContext';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import TripTopNav from './components/TripTopNav';
import TripBottomNav from './components/TripBottomNav';
import LoginPage from './pages/LoginPage';
import TripsPage from './pages/TripsPage';
import CreateTripPage from './pages/CreateTripPage';
import PollsPage from './pages/PollsPage';
import ChatPage from './pages/ChatPage';
import ItineraryPage from './pages/ItineraryPage';
import ExpensesPage from './pages/ExpensesPage';
import BlogPage from './pages/BlogPage';
import JoinTripPage from './pages/JoinTripPage';
import PlannerPage from './pages/PlannerPage';
import MembersPage from './pages/MembersPage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './config/firebase';
import MapsProvider from './components/MapsProvider';
import { isTripClaimed } from './utils/draftTrips';
import { joinTripByCode, isTripMember } from './services/firestoreService';
import { Users, LogIn, Loader } from 'lucide-react';
import { GuestModeProvider } from './context/GuestModeContext';

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
            await joinTripByCode(inviteCode, user.uid);
            setDone(true);
            setSearchParams({}); // Clear query if present
        } catch (e) {
            console.error(e);
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
            <button
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
                    const tripSnap = await getDoc(doc(db, 'trips', tripId));
                    if (tripSnap.exists()) {
                        setSelectedTrip({ id: tripSnap.id, ...tripSnap.data() });
                    }
                } catch (e) {
                    console.error('Failed to load trip:', e);
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

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/join/:inviteCode" element={<JoinTripPage />} />

            {/* Home / dashboard lives at the root */}
            <Route path="/" element={<><Navbar /><MapsProvider><TripsPage /></MapsProvider></>} />
            <Route path="/trips" element={<Navigate to="/" replace />} />
            <Route path="/trips/create" element={<><Navbar /><CreateTripPage /></>} />

            {/* Trip detail layout — unified nav inside TripLayout */}
            <Route path="/trip/:tripId" element={<TripLayout />}>
                <Route index element={<PlannerPage />} />
                <Route path="map" element={<MapRouteRedirect />} />
                <Route path="itinerary" element={<ItineraryPage />} />
                {/* Collaborative sections — gated until the trip is claimed */}
                <Route element={<ClaimedRoute />}>
                    <Route path="polls" element={<PollsPage />} />
                    <Route path="chat" element={<ChatPage />} />
                    <Route path="expenses" element={<ExpensesPage />} />
                    <Route path="members" element={<MembersPage />} />
                </Route>
            </Route>

            {/* Marketing / SEO routes */}
            <Route path="/blog" element={<><Navbar /><BlogPage /></>} />
            <Route path="/blog/:postId" element={<><Navbar /><BlogPage /></>} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <TripProvider>
                    <ScrollToTop />
                    <AppRoutes />
                </TripProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
