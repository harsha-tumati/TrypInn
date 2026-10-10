// src/utils/publicTrips.js
// What a public trip's card shows, stored on the trip itself when it's listed
// (and refreshed as the plan changes), so the public list never has to read
// anyone's places or members.

const HIGHLIGHTS = 4;

/** Stop count and the first few stop names, from places or planner stops. */
export function publicSummaryFor(stops) {
    const located = (stops || []).filter(s => s && s.lat != null && s.name);
    return {
        publicStopCount: located.length,
        publicHighlights: located.slice(0, HIGHLIGHTS).map(s => s.name),
    };
}
