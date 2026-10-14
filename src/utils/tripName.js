// src/utils/tripName.js — generates a friendly trip name from whatever the
// user has filled in, so the Trip Name field can be optional.
const FLAVORS = ['Getaway', 'Trip', 'Adventure', 'Escape', 'Expedition', 'Journey'];

function titleCase(str) {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Pulls the first meaningful place name out of a "Goa, Manali — beaches" string.
function firstPlace(str) {
    if (!str) return '';
    return str.split(/[,/–—-]/)[0].trim();
}

/**
 * Build a trip name suggestion.
 * @param {object} opts
 * @param {string} [opts.destination] - destination / route field
 * @param {string} [opts.startingPoint] - starting location name
 * @param {Date|string} [opts.startDate] - trip start date
 * @param {number} [opts.seed] - keeps the flavour stable across renders
 */
export function suggestTripName({ destination, startingPoint, startDate, seed } = {}) {
    const place = titleCase(firstPlace(destination) || firstPlace(startingPoint));
    const flavorIndex = (seed ?? Math.floor(Math.random() * FLAVORS.length)) % FLAVORS.length;
    const flavor = FLAVORS[flavorIndex];
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();

    if (place) return `${place} ${flavor} ${year}`;
    return `My ${flavor} ${year}`;
}

// A word in front makes each made-up name its own: two trips from Chennai
// don't both end up "Getaway from Chennai".
const MOODS = ['Breezy', 'Sunny', 'Easy', 'Grand', 'Golden', 'Wild', 'Spontaneous', 'Lazy', 'Big', 'Little', 'Starry', 'Salty'];

/**
 * A name for a trip left unnamed when it's created: "Breezy Goa Getaway ·
 * 22 Oct" from where it's headed and when, else "Breezy Getaway from
 * Chennai" (from, because the start is where people leave, not where
 * they're going).
 * @param {object} opts
 * @param {string} [opts.destination] - first place answered in "Where to?"
 * @param {string} [opts.startingPoint] - starting location name
 * @param {Date|string} [opts.startDate] - trip start date
 * @param {number} [opts.seed] - keeps the word stable across renders
 */
export function suggestGetawayName({ destination, startingPoint, startDate, seed } = {}) {
    const mood = MOODS[(seed ?? Math.floor(Math.random() * MOODS.length)) % MOODS.length];
    const to = titleCase(firstPlace(destination));
    const from = titleCase(firstPlace(startingPoint));
    const when = startDate
        ? new Date(startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        : '';
    const base = to ? `${mood} ${to} Getaway` : `${mood} Getaway${from ? ` from ${from}` : ''}`;
    return `${base}${when ? ` · ${when}` : ''}`;
}
