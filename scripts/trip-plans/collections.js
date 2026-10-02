// scripts/trip-plans/collections.js
//
// Most blogs are about one place, so their plan is just that destination's
// places. The topical ones — coolcations, destination dupes, honeymoons — are
// not, and a single destination would be the wrong answer for them.
//
// COLLECTIONS maps those blog ids to a shortlist of destinations. The plan
// generator builds one sub-plan per destination and presents them as options,
// so "Generate itinerary" asks the reader which one they want first.
//
// Blogs absent from both this table and the destination resolver get no plan
// and no buttons, which is the right outcome for something like the ETIAS
// explainer or a packing guide.

export const COLLECTIONS = {
    'coolcations-cool-destinations-summer': {
        title: 'Cool-summer escapes',
        blurb: 'Northern destinations that stay mild when the Mediterranean bakes.',
        destinations: ['Norway', 'Iceland', 'Scotland', 'Finland', 'Estonia', 'the Swiss Alps', 'Canada'],
    },
    'slow-travel-one-city-two-weeks': {
        title: 'Cities worth two weeks',
        blurb: 'Places with enough depth, and enough day trips, to stay put.',
        destinations: ['Portugal', 'Italy', 'Japan', 'Mexico City', 'Georgia', 'Vietnam', 'Slovenia'],
    },
    'set-jetting-film-tv-travel': {
        title: 'Screen-location trips',
        blurb: 'Regions that carry a film or series and stand up on their own.',
        destinations: ['Croatia', 'New Zealand', 'Scotland', 'Iceland', 'Italy', 'Spain'],
    },
    'noctourism-dark-sky-northern-lights': {
        title: 'After-dark destinations',
        blurb: 'Auroras, dark-sky reserves and the places worth staying up for.',
        destinations: ['Iceland', 'Finland', 'Norway', 'Namibia', 'Chile', 'New Zealand'],
    },
    'sleep-tourism-rest-retreats': {
        title: 'Trips built around rest',
        blurb: 'Somewhere quiet, dark and structured enough to actually sleep.',
        destinations: ['Kerala', 'Thailand', 'Japan', 'Finland', 'Sri Lanka', 'the Swiss Alps'],
    },
    'destination-dupes-alternatives-to-crowded-places': {
        title: 'The quieter alternatives',
        blurb: 'Same landscape, same food, a fraction of the queue.',
        destinations: ['Albania', 'Montenegro', 'Slovenia', 'Portugal', 'Taiwan', 'Oman', 'Gokarna'],
    },
    'micro-cations-short-trip-planning': {
        title: 'Three-day trips',
        blurb: 'Compact places you can reach fast and see properly in 72 hours.',
        destinations: ['Goa', 'Pondicherry', 'Coorg', 'Gokarna', 'Singapore', 'Sri Lanka'],
    },
    'multigenerational-travel-planning': {
        title: 'Trips that work for every age',
        blurb: 'Short flights, easy terrain, and somewhere everyone can opt out.',
        destinations: ['Portugal', 'Thailand', 'Kerala', 'Goa', 'Sri Lanka', 'Italy'],
    },
    'workation-remote-work-travel-guide': {
        title: 'Workation bases',
        blurb: 'Reliable connectivity, a co-working scene, and a good evening.',
        destinations: ['Portugal', 'Thailand', 'Vietnam', 'Georgia', 'Mexico City', 'Spain'],
    },
    'wellness-travel-retreats-guide': {
        title: 'Wellness destinations',
        blurb: 'Where the structured programmes — and the hot springs — actually are.',
        destinations: ['Kerala', 'Thailand', 'Sri Lanka', 'Japan', 'India', 'Bali'],
    },
    'best-time-to-visit-southeast-asia-month-by-month': {
        title: 'Southeast Asia, by season',
        blurb: 'Four destinations whose good months barely overlap.',
        destinations: ['Thailand', 'Vietnam', 'Bali', 'Sri Lanka'],
    },
    'long-weekends-2027-india-leave-calendar': {
        title: 'Long-weekend escapes',
        blurb: 'Close enough to reach on a Friday, worth the leave day.',
        destinations: ['Goa', 'Coorg', 'Pondicherry', 'Gokarna', 'Rishikesh', 'Udaipur', 'Kasol'],
    },
    'kashmir-spiti-sikkim-mountain-trips': {
        title: "India's great mountain trips",
        blurb: 'Three Himalayan regions, three completely different trips.',
        destinations: ['Kashmir', 'Spiti Valley', 'Gangtok', 'Leh-Ladakh'],
    },
    'greece-beyond-santorini-islands': {
        title: 'Greek islands worth the ferry',
        blurb: 'The Cyclades beyond the two everyone books.',
        destinations: ['Greece', 'Santorini'],
    },
    'portugal-spain-rail-trip': {
        title: 'The Iberian rail route',
        blurb: 'Lisbon to Barcelona without a car.',
        destinations: ['Portugal', 'Spain', 'Barcelona'],
    },
    'honeymoon-destinations-by-budget-and-season': {
        title: 'Honeymoon shortlists',
        blurb: 'Sorted by what you can comfortably spend.',
        destinations: ['the Maldives', 'Sri Lanka', 'Italy', 'Japan', 'Bali', 'Kenya', 'Greece'],
    },
    'europe-night-trains-routes-and-booking': {
        title: 'Night-train Europe',
        blurb: 'Cities you can reach overnight from a station, not an airport.',
        destinations: ['Austria', 'Italy', 'Germany', 'Netherlands', 'Scotland'],
    },
    'shoulder-season-travel-guide': {
        title: 'Shoulder-season picks',
        blurb: 'Destinations transformed by going a month either side of peak.',
        destinations: ['Italy', 'Greece', 'Japan', 'Croatia', 'Morocco', 'Portugal'],
    },
    'solo-female-travel-safety-guide': {
        title: 'Good first solo trips',
        blurb: 'Places that consistently come up as easy, safe and rewarding alone.',
        destinations: ['Japan', 'Taiwan', 'Portugal', 'Slovenia', 'Vietnam', 'Georgia', 'New Zealand'],
    },
    'how-much-does-a-trip-cost-daily-budgets': {
        title: 'Compare the cost',
        blurb: 'Run the estimate against destinations at every price point.',
        destinations: ['Vietnam', 'India', 'Portugal', 'Japan', 'Italy', 'the USA', 'Norway'],
    },
    'visa-free-countries-for-indian-passport-holders': {
        title: 'Visa-free on an Indian passport',
        blurb: 'Destinations you can book without arranging a visa first.',
        destinations: ['Thailand', 'the Maldives', 'Sri Lanka', 'Nepal', 'Indonesia', 'Malaysia', 'Kenya'],
    },
    'krabi-over-phuket-thailand-quieter-coast': {
        title: "Thailand's quieter coast",
        blurb: 'Krabi and the islands south of it.',
        destinations: ['Thailand'],
    },
    'japan-beyond-tokyo-kyoto': {
        title: 'Japan beyond the classics',
        blurb: 'Where to go when Kyoto is full.',
        destinations: ['Japan', 'Kyoto', 'Tokyo'],
    },
    'georgia-armenia-caucasus-road-trip': {
        title: 'The Caucasus road trip',
        blurb: 'Two countries, one drive.',
        destinations: ['Georgia', 'Armenia'],
    },
    'montenegro-slovenia-adriatic-alpine': {
        title: 'Adriatic and Alpine',
        blurb: 'A coastline and a mountain range, a flight apart.',
        destinations: ['Montenegro', 'Slovenia'],
    },
    'northeast-india-itinerary': {
        title: 'Northeast India',
        blurb: 'Meghalaya, Assam and the road further east.',
        destinations: ['Meghalaya', 'Kaziranga National Park', 'Cherrapunji', 'Majuli', 'Shillong'],
    },
};

// Destinations a hand-written post covers that the generated blog catalogue
// (DESTS in generate-blogs.js) never had. Merged into the resolver so those
// posts get a plan like any other.
export const EXTRA_DESTINATIONS = [
    { name: 'Saudi Arabia', country: 'Saudi Arabia', tags: ['Saudi Arabia', 'Middle East', 'Heritage'] },
];

// Blogs that are advice rather than destinations. Listed explicitly so the
// generator can report "no plan, on purpose" instead of silently skipping and
// hiding a bug.
export const NO_PLAN = new Set([
    'etias-europe-travel-authorisation-guide',
    'eu-entry-exit-system-ees-biometric-borders',
    'uk-eta-electronic-travel-authorisation-guide',
    'schengen-visa-application-guide',
    'digital-nomad-visas-guide',
    'asia-entry-rules-digital-arrival-cards',
    'passport-rules-travel-document-mistakes',
    'when-to-book-flights-cheapest-fares',
    'forex-cards-vs-credit-cards-paying-abroad',
    'travel-insurance-what-it-actually-covers',
    'hidden-travel-fees-to-watch-for',
    'airline-miles-hotel-points-beginners-guide',
    'flight-deal-hacks-that-still-work',
    'best-esim-for-international-travel',
    'ai-trip-planning-how-to-use-it',
    'carry-on-only-packing-system',
    'beating-jet-lag-protocol',
    'airport-security-rules-faster-lanes',
    'travel-apps-worth-installing',
    'overtourism-tourist-taxes-booking-rules',
]);

// must-visits slugs use different names from the blog destination list. Only
// the ones that actually differ need an entry; exact matches resolve on their
// own.
export const MUST_VISIT_ALIASES = {
    'Leh Ladakh': 'leh-ladakh',
    'the Andaman Islands': 'andaman-islands',
    Kerala: 'kerala-backwaters',
    'Northeast India': 'meghalaya',
    Meghalaya: 'meghalaya',
    'Himachal Pradesh': 'manali',
    Rajasthan: 'jaipur',
    Bengaluru: 'coorg',
    Chennai: 'mahabalipuram',
    Pune: 'lonavala',
    Mumbai: 'lonavala',
    Kolkata: 'darjeeling',
    Kashmir: 'kashmir',
    'Spiti Valley': 'spiti-valley',
    Gangtok: 'gangtok',
    Goa: 'goa',
    Delhi: 'delhi',
    Hyderabad: 'hyderabad',
    Varanasi: 'varanasi',
    Jaipur: 'jaipur',
};
