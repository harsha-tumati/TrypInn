// src/context/TripContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { isTripClaimed } from '../utils/draftTrips';
import { useAuth } from './AuthContext';

const TripContext = createContext(null);

async function loadFirebase() {
    const [{ db }, { collection, doc, onSnapshot, query, where, orderBy, getDoc }] =
        await Promise.all([
            import('../config/firebase').then((m) => m.getFirebase()),
            import('firebase/firestore'),
        ]);
    return { db, collection, doc, onSnapshot, query, where, orderBy, getDoc };
}

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
    const collaborationReady = isTripClaimed(selectedTrip);

    // Reset derived state when the active trip changes — must be in useEffect
    // to avoid React's "setState during render" warning and cascading renders.
    useEffect(() => {
        if (currentTripId !== activeTripId) {
            setActiveTripId(currentTripId);
            setPlaces([]);
            setPolls([]);
            setMessages([]);
            setExpenses([]);
            setMembers([]);
            setRouteResult(null);
        }
    }, [currentTripId, activeTripId]);

    useEffect(() => {
        if (collaborationReady !== collabActive) {
            setCollabActive(collaborationReady);
            if (!collaborationReady) {
                setPolls([]);
                setMessages([]);
                setExpenses([]);
                setMembers([]);
            }
        }
    }, [collaborationReady, collabActive]);

    // Real-time listener for places in the selected trip
    useEffect(() => {
        if (!currentTripId) return;
        let unsub = null;
        (async () => {
            const { db, collection, query, where, onSnapshot } = await loadFirebase();
            const q = query(
                collection(db, 'places'),
                where('tripId', '==', currentTripId)
            );
            unsub = onSnapshot(q, (snap) => {
                setPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            });
        })();
        return () => { if (unsub) unsub(); };
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
                return 0;
            });
        }
        return copy;
    }, [places, selectedTrip?.placeOrder]);

    // Real-time listener for polls
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        let unsub = null;
        (async () => {
            const { db, collection, query, where, orderBy, onSnapshot } = await loadFirebase();
            const q = query(
                collection(db, 'polls'),
                where('tripId', '==', currentTripId),
                orderBy('createdAt', 'desc')
            );
            unsub = onSnapshot(q, (snap) => {
                setPolls(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            });
        })();
        return () => { if (unsub) unsub(); };
    }, [currentTripId, collaborationReady]);

    // Real-time listener for chat messages
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        let unsub = null;
        (async () => {
            const { db, collection, query, where, orderBy, onSnapshot } = await loadFirebase();
            const q = query(
                collection(db, 'messages'),
                where('tripId', '==', currentTripId),
                orderBy('timestamp', 'asc')
            );
            unsub = onSnapshot(q, (snap) => {
                setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            });
        })();
        return () => { if (unsub) unsub(); };
    }, [currentTripId, collaborationReady]);

    // Real-time listener for expenses
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        let unsub = null;
        (async () => {
            const { db, collection, query, where, orderBy, onSnapshot } = await loadFirebase();
            const q = query(
                collection(db, 'expenses'),
                where('tripId', '==', currentTripId),
                orderBy('timestamp', 'desc')
            );
            unsub = onSnapshot(q, (snap) => {
                setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            });
        })();
        return () => { if (unsub) unsub(); };
    }, [currentTripId, collaborationReady]);

    // Real-time listener for trip members (includes live location)
    useEffect(() => {
        if (!currentTripId || !collaborationReady) return;
        let isMounted = true;
        let unsub = null;
        const userCache = {};

        (async () => {
            const { db, collection, query, where, onSnapshot, getDoc, doc } = await loadFirebase();
            const q = query(
                collection(db, 'tripMembers'),
                where('tripId', '==', currentTripId)
            );

            unsub = onSnapshot(q, async (snap) => {
                const memberDocs = snap.docs.map((d) => d.data());
                const enrichedMembers = await Promise.all(
                    memberDocs.map(async (m) => {
                        if (!userCache[m.uid]) {
                            const userSnap = await getDoc(doc(db, 'users', m.uid));
                            if (userSnap.exists()) {
                                userCache[m.uid] = userSnap.data();
                            } else {
                                userCache[m.uid] = { displayName: 'Unknown User', photoURL: null };
                            }
                        }
                        return {
                            ...userCache[m.uid],
                            role: m.role,
                            currentLocation: m.currentLocation,
                            locationUpdatedAt: m.locationUpdatedAt,
                            uid: m.uid,
                        };
                    })
                );

                if (isMounted) setMembers(enrichedMembers);
            });
        })();

        return () => {
            isMounted = false;
            if (unsub) unsub();
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
