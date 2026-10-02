// src/services/firestoreService.js
import { nanoid } from '../utils/nanoid';

async function getFirebase() {
    const [{ db }, { collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, serverTimestamp }] =
        await Promise.all([
            import('../config/firebase').then((m) => m.getFirebase()),
            import('firebase/firestore'),
        ]);
    return { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, serverTimestamp };
}

// ─── TRIPS ────────────────────────────────────────────────────────────────────

export async function createTrip({ name, destination, description, startDate, endDate, budget, userId, startingPoint, endingPoint }) {
    const { db, collection, addDoc, serverTimestamp, setDoc, doc } = await getFirebase();
    const inviteCode = nanoid(8);
    const tripRef = await addDoc(collection(db, 'trips'), {
        name,
        destination,
        description: description || '',
        startDate,
        endDate,
        budget: budget || null,
        startingPoint: startingPoint || null,
        endingPoint: endingPoint || null,
        createdBy: userId || null,
        claimed: !!userId,
        inviteCode,
        itinerary: [],
        createdAt: serverTimestamp(),
    });

    if (userId) {
        await setDoc(doc(db, 'tripMembers', `${tripRef.id}_${userId}`), {
            tripId: tripRef.id,
            uid: userId,
            role: 'admin',
            joinedAt: serverTimestamp(),
            currentLocation: null,
            locationUpdatedAt: null,
        });
    }

    return tripRef.id;
}

export async function claimTrip(tripId, userId) {
    const { db, updateDoc, doc, getDoc, setDoc, serverTimestamp } = await getFirebase();
    if (!tripId || !userId) throw new Error('A signed-in account is required to save this trip.');
    await updateDoc(doc(db, 'trips', tripId), { claimed: true, createdBy: userId });
    const memberRef = doc(db, 'tripMembers', `${tripId}_${userId}`);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
        await setDoc(memberRef, {
            tripId,
            uid: userId,
            role: 'admin',
            joinedAt: serverTimestamp(),
            currentLocation: null,
            locationUpdatedAt: null,
        });
    }
}

export async function getTripsByIds(ids) {
    const { db, getDoc, doc } = await getFirebase();
    const trips = [];
    for (const id of ids || []) {
        try {
            const snap = await getDoc(doc(db, 'trips', id));
            if (snap.exists()) trips.push({ id: snap.id, ...snap.data() });
        } catch { /* skip unreadable/missing draft */ }
    }
    return trips;
}

export async function updateTripStatus(tripId, status) {
    const { db, updateDoc, doc } = await getFirebase();
    await updateDoc(doc(db, 'trips', tripId), { status });
}

export async function updatePlaceOrder(tripId, placeOrder) {
    const { db, updateDoc, doc } = await getFirebase();
    await updateDoc(doc(db, 'trips', tripId), { placeOrder });
}

export async function updateRouteConfig(tripId, routeConfig) {
    const { db, updateDoc, doc } = await getFirebase();
    await updateDoc(doc(db, 'trips', tripId), { routeConfig });
}

export async function updateTrip(tripId, fields) {
    const { db, updateDoc, doc } = await getFirebase();
    await updateDoc(doc(db, 'trips', tripId), fields);
}

export async function getUserTrips(userId) {
    const { db, getDocs, query, collection, where, getDoc, doc } = await getFirebase();
    const membersSnap = await getDocs(
        query(collection(db, 'tripMembers'), where('uid', '==', userId))
    );
    const tripIds = membersSnap.docs.map((d) => d.data().tripId);

    if (tripIds.length === 0) return [];

    const trips = [];
    for (const tripId of tripIds) {
        const tripSnap = await getDoc(doc(db, 'trips', tripId));
        if (tripSnap.exists()) {
            trips.push({ id: tripSnap.id, ...tripSnap.data() });
        }
    }
    return trips.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
    });
}

export async function getTripByInviteCode(inviteCode) {
    const { db, query, collection, where, getDocs } = await getFirebase();
    const q = query(collection(db, 'trips'), where('inviteCode', '==', inviteCode));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}

export async function getTripMemberCount(tripId) {
    const { db, query, collection, where, getDocs } = await getFirebase();
    const q = query(collection(db, 'tripMembers'), where('tripId', '==', tripId));
    const snap = await getDocs(q);
    return snap.size;
}

export async function isTripMember(tripId, userId) {
    const { db, doc, getDoc } = await getFirebase();
    const memberRef = doc(db, 'tripMembers', `${tripId}_${userId}`);
    const snap = await getDoc(memberRef);
    return snap.exists();
}

export async function joinTripByCode(inviteCode, userId) {
    const { db, query, collection, where, getDocs, doc, getDoc, setDoc, serverTimestamp } = await getFirebase();
    const q = query(collection(db, 'trips'), where('inviteCode', '==', inviteCode));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Invalid invite code');

    const tripDoc = snap.docs[0];
    const tripId = tripDoc.id;
    const memberDocId = `${tripId}_${userId}`;
    const memberRef = doc(db, 'tripMembers', memberDocId);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
        await setDoc(memberRef, {
            tripId,
            uid: userId,
            role: 'member',
            joinedAt: serverTimestamp(),
            currentLocation: null,
            locationUpdatedAt: null,
        });
    }
    return tripId;
}

export async function getTripMembers(tripId) {
    const { db, query, collection, where, getDocs, getDoc, doc } = await getFirebase();
    const q = query(collection(db, 'tripMembers'), where('tripId', '==', tripId));
    const snap = await getDocs(q);
    const memberDocs = snap.docs.map((d) => d.data());

    const members = [];
    for (const m of memberDocs) {
        const userSnap = await getDoc(doc(db, 'users', m.uid));
        if (userSnap.exists()) {
            members.push({ ...userSnap.data(), role: m.role, currentLocation: m.currentLocation, locationUpdatedAt: m.locationUpdatedAt });
        }
    }
    return members;
}

export async function getTripPlaces(tripId) {
    const { db, query, collection, where, getDocs } = await getFirebase();
    const q = query(collection(db, 'places'), where('tripId', '==', tripId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateMemberLocation(tripId, userId, lat, lng) {
    const { db, updateDoc, doc, serverTimestamp } = await getFirebase();
    const memberDocId = `${tripId}_${userId}`;
    await updateDoc(doc(db, 'tripMembers', memberDocId), {
        currentLocation: { lat, lng },
        locationUpdatedAt: serverTimestamp(),
    });
}

// ─── PLACES ───────────────────────────────────────────────────────────────────

export async function addPlaces(tripId, placesArray) {
    const { db, collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query, where, getDocs } = await getFirebase();
    const results = [];
    for (const p of placesArray) {
        let existingId = null;

        if (p.id && !p.id.startsWith('stop-')) {
            const docRef = doc(db, 'places', p.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().tripId === tripId) {
                existingId = p.id;
            }
        }

        if (!existingId) {
            const q = query(collection(db, 'places'), where('tripId', '==', tripId), where('name', '==', p.name));
            const snap = await getDocs(q);
            if (!snap.empty) {
                existingId = snap.docs[0].id;
            }
        }

        if (existingId) {
            results.push(existingId);
            const updates = {};
            if (p.estimatedMinutes !== undefined) updates.estimatedMinutes = p.estimatedMinutes;
            if (p.lat !== undefined) updates.lat = p.lat;
            if (p.lng !== undefined) updates.lng = p.lng;
            if (p.imageUrl !== undefined) updates.imageUrl = p.imageUrl;
            if (p.description !== undefined) updates.description = p.description;

            if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, 'places', existingId), updates);
            }
            continue;
        }

        const { id, ...dataToSave } = p;
        const ref = await addDoc(collection(db, 'places'), {
            tripId,
            ...dataToSave,
            selected: false,
            addedAt: serverTimestamp(),
        });
        results.push(ref.id);
    }
    return results;
}

export async function togglePlaceSelected(placeId, selected) {
    const { db, updateDoc, doc } = await getFirebase();
    await updateDoc(doc(db, 'places', placeId), { selected });
}

export async function updatePlaceDuration(placeId, estimatedMinutes) {
    const { db, updateDoc, doc } = await getFirebase();
    await updateDoc(doc(db, 'places', placeId), { estimatedMinutes });
}

export async function deletePlace(placeId) {
    const { db, deleteDoc, doc } = await getFirebase();
    await deleteDoc(doc(db, 'places', placeId));
}

// ─── POLLS ────────────────────────────────────────────────────────────────────

export async function createPoll({ tripId, title, placeIds, createdBy }) {
    const { db, collection, addDoc, serverTimestamp } = await getFirebase();
    const options = placeIds.map((placeId) => ({ placeId, votes: [] }));
    const ref = await addDoc(collection(db, 'polls'), {
        tripId,
        title,
        options,
        status: 'open',
        createdBy,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function castVote({ pollId, placeId, userId }) {
    const { db, doc, getDoc, updateDoc } = await getFirebase();
    const pollRef = doc(db, 'polls', pollId);
    const pollSnap = await getDoc(pollRef);
    if (!pollSnap.exists()) return;

    const data = pollSnap.data();
    const updatedOptions = data.options.map((opt) => {
        const filteredVotes = opt.votes.filter((uid) => uid !== userId);
        if (opt.placeId === placeId) {
            return { ...opt, votes: [...filteredVotes, userId] };
        }
        return { ...opt, votes: filteredVotes };
    });

    await updateDoc(pollRef, { options: updatedOptions });
}

export async function closePoll(pollId, _tripId) {
    const { db, doc, getDoc, updateDoc } = await getFirebase();
    const pollRef = doc(db, 'polls', pollId);
    const pollSnap = await getDoc(pollRef);
    if (!pollSnap.exists()) return;

    const data = pollSnap.data();
    let maxVotes = 0;
    let winnerId = null;

    for (const opt of data.options) {
        if (opt.votes.length > maxVotes) {
            maxVotes = opt.votes.length;
            winnerId = opt.placeId;
        }
    }

    await updateDoc(pollRef, { status: 'closed', winnerId });

    if (winnerId) {
        await togglePlaceSelected(winnerId, true);
    }
    return winnerId;
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

export async function sendMessage({ tripId, uid, text, placeRef = null, senderName, senderPhoto, mentions = [] }) {
    const { db, collection, addDoc, serverTimestamp } = await getFirebase();
    await addDoc(collection(db, 'messages'), {
        tripId,
        uid,
        senderName: senderName || null,
        senderPhoto: senderPhoto || null,
        text,
        placeRef: placeRef || null,
        // Who this message tagged: [{ id, label, kind }]. Recorded at send
        // time so the uids survive a later display-name change, and so the
        // bubble does not have to guess which words were mentions.
        mentions: mentions.length ? mentions : [],
        timestamp: serverTimestamp(),
    });
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

export async function addExpense({ tripId, title, amount, paidBy, splitAmong }) {
    const { db, collection, addDoc, serverTimestamp } = await getFirebase();
    await addDoc(collection(db, 'expenses'), {
        tripId,
        title,
        amount: parseFloat(amount),
        paidBy,
        splitAmong,
        timestamp: serverTimestamp(),
    });
}

export function calcBalances(expenses, members) {
    const balances = {};
    members.forEach((m) => (balances[m.uid] = 0));

    for (const exp of expenses) {
        const share = exp.amount / exp.splitAmong.length;
        if (balances[exp.paidBy] !== undefined) {
            balances[exp.paidBy] += exp.amount - share;
        }
        for (const uid of exp.splitAmong) {
            if (uid !== exp.paidBy && balances[uid] !== undefined) {
                balances[uid] -= share;
            }
        }
    }
    return balances;
}

// ─── ITINERARY ────────────────────────────────────────────────────────────────

export async function saveItinerary(tripId, itinerary) {
    const { db, updateDoc, doc } = await getFirebase();
    await updateDoc(doc(db, 'trips', tripId), { itinerary });
}
