// src/utils/draftTrips.js
// Anonymous "draft" trips are created without a signed-in user. We remember
// their ids on the device (localStorage) so the home dashboard can list them
// until the user claims the trip to their profile.

const KEY = 'tripsync_drafts';

export function getDraftIds() {
    try {
        const v = JSON.parse(localStorage.getItem(KEY));
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

export function addDraftId(id) {
    if (!id) return;
    const ids = getDraftIds().filter((x) => x !== id);
    ids.unshift(id);
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* quota */ }
}

export function removeDraftId(id) {
    const ids = getDraftIds().filter((x) => x !== id);
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* quota */ }
}

// A trip is "claimed" once it belongs to a profile. Older trips predate the
// `claimed` flag — fall back to whether they have a creator.
export function isTripClaimed(trip) {
    if (!trip) return false;
    if (typeof trip.claimed === 'boolean') return trip.claimed;
    return !!trip.createdBy;
}
