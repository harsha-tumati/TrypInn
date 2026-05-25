// src/context/TripContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db } from '../config/firebase';
import { isTripClaimed } from '../utils/draftTrips';
import { useAuth } from './AuthContext';
import {
    collection,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    getDoc,
} from 'firebase/firestore';

const TripContext = createContext(null);

export function TripProvider({ children }) {
    const { user } = useAuth();
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [places, setPlaces] = useState([]);
    const [polls, setPolls] = useState([]);
    const [messages, setMessages] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [members, setMembers] = useState([]);
    const [routeResult, setRouteResult] = useState(null);
    const [activeTripId, setActiveTripId] = useState(null);
    const [collabActive, setCollabActive] = useState(false);

    const currentTripId = selectedTrip?.id ?? null;
    // Polls/chat/expenses/members are collaborative: they exist only once a trip is claimed.
    // We now allow read access for guests, so we attach listeners as long as it's claimed.
    const collaborationReady = isTripClaimed(selectedTrip);

    // When the active trip changes, clear trip-scoped state *synchronously
    // during render* so consumers never see the previous trip's data while
    // the new Firestore listeners spin up. This is React's sanctioned
    // "adjust state when a prop changes" pattern — guarded so it runs once.
    if (currentTripId !== activeTripId) {
        setActiveTripId(currentTripId);
        setPlaces([]);
        setPolls([]);
        setMessages([]);
        setExpenses([]);
        setMembers([]);
        setRouteResult(null);
    }

    // When collaboration access is lost — sign-out, or the trip is no longer
    // claimed — drop the collaborative data so it can't linger on screen after
    // its listeners detach. Same render-phase pattern, guarded to run once.
    if (collaborationReady !== collabActive) {
        setCollabActive(collaborationReady);
        if (!collaborationReady) {
            setPolls([]);
            setMessages([]);
            setExpenses([]);
            setMembers([]);
        }
    }

    // Real-time listener for places in the selected trip
    useEffect(() => {
        if (!currentTripId) return;
        const q = query(
            collection(db, 'places'),
            where('tripId', '==', currentTripId)
        );
        return onSnapshot(q, (snap) => {
            setPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, [currentTripId]);

    const sortedPlaces = useMemo(() => {
        if (!places) return [];
        const copy = [...places];
        if (selectedTrip?.placeOrder && selectedTrip.placeOrder.length > 0) {
            copy.sort((a, b) => {
                const idxA = selectedTrip.placeOrder.indexOf(a.id);
                const idxB = selectedTrip.placeOrder.indexOf(b.id);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0; // maintain relative order for unordered items
            });
        }
        return copy;
    }, [places, selectedTrip?.placeOrder]);

    // Real-time listener for polls
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        const q = query(
            collection(db, 'polls'),
            where('tripId', '==', currentTripId),
            orderBy('createdAt', 'desc')
        );
        return onSnapshot(q, (snap) => {
            setPolls(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, [currentTripId, collaborationReady]);

    // Real-time listener for chat messages
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        const q = query(
            collection(db, 'messages'),
            where('tripId', '==', currentTripId),
            orderBy('timestamp', 'asc')
        );
        return onSnapshot(q, (snap) => {
            setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, [currentTripId, collaborationReady]);

    // Real-time listener for expenses
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        const q = query(
            collection(db, 'expenses'),
            where('tripId', '==', currentTripId),
            orderBy('timestamp', 'desc')
        );
        return onSnapshot(q, (snap) => {
            setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, [currentTripId, collaborationReady]);

    // Real-time listener for trip members (includes live location)
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        const q = query(
            collection(db, 'tripMembers'),
            where('tripId', '==', currentTripId)
        );

        let isMounted = true;
        const userCache = {}; // Cache user details to avoid refetching on every location ping

        const unsub = onSnapshot(q, async (snap) => {
            const memberDocs = snap.docs.map(d => d.data());
            const enrichedMembers = await Promise.all(memberDocs.map(async (m) => {
                if (!userCache[m.uid]) {
                    const userSnap = await getDoc(doc(db, 'users', m.uid));
                    if (userSnap.exists()) {
                        userCache[m.uid] = userSnap.data();
                    } else {
                        userCache[m.uid] = { displayName: 'Unknown User', photoURL: null };
                    }
                }
                return { ...userCache[m.uid], role: m.role, currentLocation: m.currentLocation, locationUpdatedAt: m.locationUpdatedAt, uid: m.uid };
            }));

            if (isMounted) setMembers(enrichedMembers);
        });

        return () => {
            isMounted = false;
            unsub();
        };
    }, [currentTripId, collaborationReady]);

    return (
        <TripContext.Provider
            value={{
                selectedTrip,
                setSelectedTrip,
                places: sortedPlaces,
                polls,
                messages,
                expenses,
                members,
                setMembers,
                routeResult,
                setRouteResult,
            }}
        >
            {children}
        </TripContext.Provider>
    );
}

export function useTrip() {
    const context = useContext(TripContext);
    if (!context) throw new Error('useTrip must be used within TripProvider');
    return context;
}
