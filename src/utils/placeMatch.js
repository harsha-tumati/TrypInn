// Whether two places are the same one, allowing for how differently the AI
// and Google write a name: "Rock Garden of Chandigarh, Chandigarh" is the
// trip's "Rock Garden of Chandigarh"; "Suicide Point, Kalpa" is "Suicide
// Point Kalpa". Used to keep places already in the trip out of suggestions.

const core = (name) => (name || '')
    .split(',')[0]
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function samePlace(a, b) {
    if (!a || !b) return false;
    const idA = a.googlePlaceId || a.placeId;
    const idB = b.googlePlaceId || b.placeId;
    if (idA && idB && idA === idB) return true;
    const x = core(a.name), y = core(b.name);
    if (!x || !y) return false;
    if (x === y) return true;
    // One name is the other plus a town ("suicide point" / "suicide point kalpa").
    const [short, long] = x.length <= y.length ? [x, y] : [y, x];
    return short.length >= 6 && (long.startsWith(`${short} `) || long.endsWith(` ${short}`));
}

/** True when `place` is already one of `list`. */
export const isAmong = (place, list) => list.some(p => samePlace(place, p));
