// src/services/publicFirestoreService.js
// Reads Firestore via the REST API — no SDK auth token required.
// Used by the public invite/preview page so unauthenticated viewers
// can see trip info, places and member list without needing to sign in.

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tripsync-5a93c';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Convert a Firestore REST "fields" object to a plain JS object
function parseFields(fields = {}) {
    const out = {};
    for (const [key, val] of Object.entries(fields)) {
        out[key] = parseValue(val);
    }
    return out;
}

function parseValue(val) {
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.doubleValue !== undefined) return Number(val.doubleValue);
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(parseValue);
    if (val.mapValue !== undefined) return parseFields(val.mapValue.fields || {});
    return null;
}

function docToObj(doc) {
    const id = doc.name.split('/').pop();
    return { id, ...parseFields(doc.fields || {}) };
}

async function runQuery(collectionId, filters = []) {
    const url = `${BASE}:runQuery`;
    const body = {
        structuredQuery: {
            from: [{ collectionId }],
            where: filters.length === 1
                ? {
                    fieldFilter: {
                        field: { fieldPath: filters[0].field },
                        op: filters[0].op || 'EQUAL',
                        value: filters[0].value,
                    }
                }
                : filters.length > 1
                    ? {
                        compositeFilter: {
                            op: 'AND',
                            filters: filters.map(f => ({
                                fieldFilter: {
                                    field: { fieldPath: f.field },
                                    op: f.op || 'EQUAL',
                                    value: f.value,
                                }
                            }))
                        }
                    }
                    : undefined,
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Firestore query failed: ${res.status}`);
    const rows = await res.json();
    return rows.filter(r => r.document).map(r => docToObj(r.document));
}

async function getDoc(collectionId, docId) {
    const url = `${BASE}/${collectionId}/${docId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = await res.json();
    return docToObj(doc);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function publicGetTripByInviteCode(inviteCode) {
    const results = await runQuery('trips', [
        { field: 'inviteCode', value: { stringValue: inviteCode } }
    ]);
    return results[0] || null;
}

export async function publicGetTripPlaces(tripId) {
    return runQuery('places', [
        { field: 'tripId', value: { stringValue: tripId } }
    ]);
}

export async function publicGetTripMembers(tripId) {
    // tripMembers only contains uid + role — user names need a second fetch
    // but that requires auth. We return what we have (uid + role + joinedAt).
    const memberDocs = await runQuery('tripMembers', [
        { field: 'tripId', value: { stringValue: tripId } }
    ]);
    return memberDocs;
}

export async function publicIsTripMember(tripId, userId) {
    const doc = await getDoc('tripMembers', `${tripId}_${userId}`);
    return !!doc;
}
