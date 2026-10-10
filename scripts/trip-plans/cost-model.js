// scripts/trip-plans/cost-model.js
//
// Per-person, per-day cost bands in USD, by country. These are the same
// figures published in the "How Much Does a Trip Actually Cost?" guide, so the
// estimate a reader sees on a blog matches the numbers in the articles.
//
// Each band covers accommodation, food, local transport and everyday
// activities. It deliberately EXCLUDES international flights and visa fees:
// airfare depends entirely on where the reader is flying from, and a number
// that is wrong half the time is worse than no number.
//
// Bands are [budget, midRange, comfortable] — the midpoint of the range given
// in the guide, so a "budget $25–35" entry is stored as 30.

export const DEFAULT_BAND = [45, 90, 180];

export const COUNTRY_COSTS = {
    // ── Southeast Asia ──
    Vietnam: [30, 65, 150],
    Thailand: [35, 80, 200],
    Indonesia: [32, 80, 225],
    Cambodia: [30, 62, 135],
    Laos: [30, 62, 135],
    Myanmar: [30, 62, 135],
    Malaysia: [35, 75, 165],
    Philippines: [37, 82, 180],
    Singapore: [60, 130, 280],
    'Hong Kong': [55, 120, 260],

    // ── South Asia ──
    India: [25, 60, 185],
    'Sri Lanka': [30, 70, 165],
    Nepal: [25, 57, 130],
    Bhutan: [110, 160, 280],
    Bangladesh: [25, 55, 120],
    Pakistan: [25, 55, 125],
    Maldives: [90, 200, 500],

    // ── East and Central Asia ──
    Japan: [72, 150, 325],
    'South Korea': [60, 125, 250],
    Taiwan: [47, 100, 210],
    China: [42, 105, 240],
    Mongolia: [40, 85, 175],
    Kazakhstan: [38, 80, 165],
    Uzbekistan: [37, 80, 180],
    Kyrgyzstan: [32, 70, 150],
    Tajikistan: [32, 70, 150],

    // ── Middle East ──
    UAE: [72, 165, 450],
    Qatar: [65, 150, 380],
    Oman: [55, 120, 280],
    Bahrain: [55, 115, 260],
    Kuwait: [60, 125, 280],
    Jordan: [60, 125, 300],
    'Saudi Arabia': [80, 180, 400],
    Lebanon: [45, 95, 200],
    Iran: [30, 65, 140],
    Turkey: [42, 97, 230],

    // ── Western and Northern Europe ──
    Switzerland: [110, 230, 450],
    Norway: [110, 230, 450],
    Iceland: [110, 230, 450],
    Denmark: [105, 215, 420],
    Sweden: [95, 190, 380],
    Finland: [95, 190, 380],
    Greenland: [120, 250, 480],
    'Faroe Islands': [100, 200, 400],
    UK: [85, 180, 365],
    Scotland: [80, 170, 340],
    Ireland: [85, 180, 360],
    France: [85, 180, 365],
    Germany: [82, 175, 350],
    Netherlands: [85, 180, 365],
    Belgium: [80, 170, 340],
    Austria: [82, 175, 350],
    Luxembourg: [90, 185, 370],
    Italy: [72, 150, 325],
    Spain: [72, 150, 325],
    Portugal: [60, 130, 265],
    Greece: [60, 130, 265],
    Malta: [60, 130, 265],
    Cyprus: [60, 130, 265],

    // ── Central, Eastern Europe and the Balkans ──
    Poland: [52, 107, 225],
    'Czech Republic': [52, 107, 225],
    Slovakia: [50, 100, 210],
    Hungary: [52, 107, 225],
    Romania: [50, 100, 210],
    Bulgaria: [45, 95, 195],
    Croatia: [58, 125, 260],
    Slovenia: [58, 125, 260],
    Montenegro: [42, 90, 200],
    Albania: [42, 90, 200],
    Bosnia: [42, 90, 200],
    Serbia: [45, 95, 195],
    Estonia: [52, 107, 225],
    Latvia: [50, 100, 210],
    Lithuania: [50, 100, 210],
    Belarus: [38, 80, 165],
    Ukraine: [38, 80, 165],
    Moldova: [35, 75, 155],
    Russia: [45, 95, 195],
    Georgia: [37, 82, 185],
    Armenia: [37, 82, 185],
    Azerbaijan: [40, 85, 180],

    // ── North America ──
    USA: [110, 230, 475],
    Canada: [97, 205, 410],
    Mexico: [47, 112, 275],
    'Puerto Rico': [70, 150, 320],
    Guam: [80, 165, 330],

    // ── Central America and the Caribbean ──
    'Costa Rica': [65, 140, 325],
    Panama: [50, 105, 230],
    Guatemala: [35, 80, 175],
    Belize: [55, 115, 250],
    Cuba: [40, 85, 180],
    Jamaica: [55, 120, 260],
    Bahamas: [85, 175, 400],
    Barbados: [80, 170, 380],
    Antigua: [85, 175, 400],
    'St Lucia': [80, 170, 380],
    'Dominican Republic': [55, 120, 260],

    // ── South America ──
    Colombia: [37, 90, 205],
    Peru: [37, 90, 205],
    Chile: [50, 112, 250],
    Argentina: [50, 112, 250],
    Brazil: [50, 120, 275],

    // ── Africa ──
    Morocco: [37, 90, 220],
    Egypt: [37, 90, 220],
    Tunisia: [35, 82, 190],
    'South Africa': [47, 105, 250],
    Kenya: [55, 130, 300],
    Tanzania: [55, 130, 300],
    Uganda: [45, 100, 220],
    Rwanda: [45, 100, 220],
    Zambia: [50, 110, 250],
    Botswana: [70, 160, 400],
    Namibia: [60, 130, 300],
    Madagascar: [40, 85, 180],
    Ghana: [40, 88, 190],
    Senegal: [40, 88, 190],

    // ── Oceania and the Pacific ──
    Australia: [90, 190, 400],
    'New Zealand': [90, 190, 400],
    Fiji: [75, 200, 420],
    Tahiti: [110, 250, 550],
    Moorea: [110, 250, 550],
    'Cook Islands': [85, 190, 400],
    Rarotonga: [85, 190, 400],
    Samoa: [70, 160, 340],
    Tonga: [70, 160, 340],
    Vanuatu: [75, 170, 360],
    Palau: [95, 200, 420],
    'Papua New Guinea': [80, 175, 370],
};

// How a day's spend splits across categories. Rough but stable, and it gives
// the reader something they can sanity-check against their own plans rather
// than one opaque total.
export const BREAKDOWN = [
    { key: 'stay', label: 'Stay', share: 0.42 },
    { key: 'food', label: 'Food', share: 0.26 },
    { key: 'transport', label: 'Local transport', share: 0.14 },
    { key: 'activities', label: 'Activities', share: 0.18 },
];

export const TIERS = [
    { key: 'budget', label: 'Budget', index: 0, blurb: 'Hostels or guesthouses, local food, public transport' },
    { key: 'midRange', label: 'Mid-range', index: 1, blurb: 'Three-star hotels, a mix of restaurants, the odd taxi' },
    { key: 'comfortable', label: 'Comfortable', index: 2, blurb: 'Good four-star stays, restaurants by choice, tours' },
];

// Display currency. The app bills everything in rupees (see ExpensesPage), so
// estimates are shown in INR with the USD band kept alongside for reference.
// Regenerated weekly, so drift between refreshes is limited; the figure is
// rounded hard enough that a few percent of FX movement does not show.
export const USD_TO_INR = 88;

/** Look up a band, falling back to a mid-range default for unlisted countries. */
export function bandFor(country) {
    return COUNTRY_COSTS[country] || DEFAULT_BAND;
}

/** Round to something that reads like an estimate rather than a quote. */
function roundMoney(n) {
    if (n >= 100000) return Math.round(n / 5000) * 5000;
    if (n >= 10000) return Math.round(n / 500) * 500;
    if (n >= 1000) return Math.round(n / 100) * 100;
    return Math.round(n / 10) * 10;
}

/**
 * Build the estimate block for a destination.
 *
 * @param {string} country  country name as used in COUNTRY_COSTS
 * @param {number} days     suggested trip length
 * @param {number} people   party size the totals are shown for
 */
export function buildEstimate(country, days, people = 2) {
    return estimateFromBand(bandFor(country), Boolean(COUNTRY_COSTS[country]), days, people);
}

/**
 * Estimate for a trip that crosses borders — Georgia into Armenia, Lisbon to
 * Barcelona. Each country's band is weighted by the days spent there, so a
 * fortnight that is mostly Spain costs like Spain rather than an average of
 * Spain and Portugal.
 *
 * @param {Array<{country: string, days: number}>} spans
 */
export function buildBlendedEstimate(spans, days, people = 2) {
    const total = spans.reduce((n, s) => n + s.days, 0);
    if (!total) return buildEstimate(spans[0]?.country, days, people);
    const band = [0, 1, 2].map(i =>
        Math.round(spans.reduce((n, s) => n + bandFor(s.country)[i] * s.days, 0) / total)
    );
    const known = spans.every(s => COUNTRY_COSTS[s.country]);
    return estimateFromBand(band, known, days, people);
}

function estimateFromBand(band, known, days, people) {

    const tiers = {};
    for (const tier of TIERS) {
        const perDayUsd = band[tier.index];
        const breakdown = {};
        for (const part of BREAKDOWN) {
            breakdown[part.key] = roundMoney(perDayUsd * part.share * USD_TO_INR);
        }
        tiers[tier.key] = {
            label: tier.label,
            blurb: tier.blurb,
            perDayUsd,
            perDayPerPerson: roundMoney(perDayUsd * USD_TO_INR),
            tripPerPerson: roundMoney(perDayUsd * USD_TO_INR * days),
            tripTotal: roundMoney(perDayUsd * USD_TO_INR * days * people),
            breakdown,
        };
    }

    return {
        currency: 'INR',
        symbol: '₹',
        usdToInr: USD_TO_INR,
        days,
        people,
        // Flagged so the UI can say "rough regional average" rather than
        // implying we have real data for this country.
        approximate: !known,
        excludes: ['International flights', 'Visa fees', 'Travel insurance', 'Shopping'],
        breakdown: BREAKDOWN,
        tiers,
    };
}
