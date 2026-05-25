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
