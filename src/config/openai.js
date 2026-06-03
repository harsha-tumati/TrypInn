// src/config/openai.js
// The OpenAI SDK is loaded dynamically so it NEVER lands in the initial
// vendor chunk — this saves ~120KB on routes that don't use AI (e.g. /blog).
let _client = null;

async function getOpenAI() {
    if (_client) return _client;
    const [{ default: OpenAI }] = await Promise.all([
        import('openai'),
    ]);
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error(
            'AI features are unavailable — VITE_OPENAI_API_KEY is not set. Add it to your .env file.'
        );
    }
    _client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    return _client;
}

// Lazily fetch the chat completions API — the client (and the SDK) are only
// loaded on the first AI call, so blog visitors never pay the download cost.
const openai = {
    get chat() {
        return { completions: { create: async (...args) => (await getOpenAI()).chat.completions.create(...args) } };
    },
};

/**
 * Get AI-powered destination suggestions using GPT-4o Mini.
 * Returns structured JSON: { places, food_places, hidden_gems }
 */
export async function getSuggestions(destination) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content:
                    'You are a travel expert. Return only valid JSON with no markdown, no explanation. Suggest top places, hidden gems, and food spots.',
            },
            {
                role: 'user',
                content: `Suggest travel places for: ${destination}. Return JSON in this exact format:
{
  "places": [{ "name": "Place Name, City", "description": "", "category": "" }],
  "food_places": [{ "name": "Restaurant Name, City", "description": "" }],
  "hidden_gems": [{ "name": "Place Name, City", "description": "" }]
}
Include at least 5 places, 4 food places, and 3 hidden gems. Always include the city name in the "name" field.`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
}

/**
 * Generate a day-by-day itinerary using GPT-4o.
 */
export async function generateItinerary({ places, duration, preferences = '' }) {
    const placeNames = places.map((p) => p.name).join(', ');

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content:
                    'You are a travel itinerary planner. Return only valid JSON with no markdown. Create an optimized day-by-day itinerary.',
            },
            {
                role: 'user',
                content: `Create a ${duration}-day itinerary for these places: ${placeNames}.
Preferences: ${preferences || 'balanced mix of activities'}.
Return JSON in this exact format:
{
  "itinerary": [
    {
      "day": 1,
      "title": "Day title",
      "activities": ["Place Name - short description", "Place Name - short description"]
    }
  ]
}`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
}

/**
 * AI Trip Assistant — context-aware chat using GPT-4o Mini.
 */
export async function chatWithAssistant({ messages, tripContext }) {
    const systemPrompt = `You are Trypinn AI, a helpful travel assistant. 
You are assisting with a trip to ${tripContext.destination}.
Trip dates: ${tripContext.startDate} to ${tripContext.endDate}.
Selected places: ${tripContext.selectedPlaces?.join(', ') || 'none yet'}.
Be concise, helpful, and context-aware. If asked about routes or distances, remind that routing uses Google Maps.`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
        ],
        max_tokens: 600,
    });

    return response.choices[0].message.content;
}

/**
 * Get AI-powered en-route suggestions given an ordered list of waypoints.
 */
export async function getEnRouteSuggestions(routePlaces) {
    const routeString = routePlaces.map(p => p.name).join(' -> ');
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content:
                    'You are an intelligent travel routing assistant. Return only valid JSON with no markdown. The user will provide a driving route (A -> B -> C). Suggest up to 5 interesting TOURIST STOPS, attractions, viewpoints, or famous restaurants that are directly ON THE WAY or require very minimal detour along this specific route. DO NOT suggest hotels, accommodations, or places in the starting or ending cities themselves unless they are on the highway exiting/entering.',
            },
            {
                role: 'user',
                content: `Suggest places to stop along this driving route: ${routeString}.
Return JSON in this exact format:
{
  "en_route_places": [
    { 
      "name": "Place Name, City", 
      "description": "Why it's a good stop", 
      "category": "attraction_or_food" 
    }
  ]
}`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
}

/**
 * Get AI-suggested realistic visit durations for a list of places.
 * Returns { durations: { [placeId]: minutes }, daysMeta: { [placeId]: days } }
 *
 * The AI thinks in DAYS for city-scale places:
 *   Puducherry (city/UT)  → 2 days → 960 min
 *   Chidambaram temple    → 1 day  →  90 min
 *   Auroville             → 1 day  → 180 min
 *   A beach               → 1 day  → 150 min
 */
export async function getPlaceVisitDurations(places) {
    if (!places || places.length === 0) return { durations: {}, daysMeta: {} };

    const placeList = places
        .map((p, i) => `${i}: ${p.name}${p.description ? ' (' + p.description.slice(0, 80) + ')' : ''}`)
        .join('\n');

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content:
                    'You are an expert travel planner. For each destination, decide how many days a typical tourist needs AND estimate total active visit minutes. Rules:\n' +
                    '- A FULL CITY or UNION TERRITORY (Puducherry, Goa, Pondicherry, Mysore, Ooty) = 2 days minimum, 960 min\n' +
                    '- A LARGE TOWN with multiple attractions (Chidambaram, Mahabalipuram) = 1 full day, 420–480 min\n' +
                    '- A SINGLE ICONIC TEMPLE or MONUMENT = 1 day, 60–120 min\n' +
                    '- A BEACH or SCENIC LAKE = 1 day, 120–180 min\n' +
                    '- A WILDLIFE SANCTUARY or NATIONAL PARK = 1–2 days, 240–480 min\n' +
                    '- A VIEWPOINT or SMALL SPOT = 1 day, 30–60 min\n' +
                    '- A MARKET or STREET = 1 day, 60–90 min\n' +
                    'Return ONLY valid JSON, no markdown.',
            },
            {
                role: 'user',
                content: `Estimate visit duration for these ${places.length} place(s):\n${placeList}\n\nReturn JSON in this exact format:\n{"places": [{"index": 0, "name": "Place", "days": 2, "minutes": 960, "reason": "It is a full city with French Quarter, beaches, temples, and cafes."}]}`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    const durations = {};
    const daysMeta = {};
    (parsed.places || parsed.durations || []).forEach(item => {
        const place = places[item.index];
        if (!place) return;
        const mins = Math.max(30, Math.round(item.minutes || (item.days * 480)));
        durations[place.id] = mins;
        if (item.days && item.days > 1) daysMeta[place.id] = item.days;
    });
    return { durations, daysMeta };
}

/**
 * Given a region name, suggest top specific places to visit inside it.
 * Returns { places: [{ name, description, category, estimatedMinutes }] }
 */
export async function getRegionPlaces(regionName, excludeNames = []) {
    const excludeStr = excludeNames.length ? `\nDo NOT suggest any of these places, we already saw them: ${excludeNames.join(', ')}` : '';
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'You are a travel expert. Given a region/city name, suggest the top specific places to visit inside it. Each place must be a concrete, visitable spot (not the city itself). Include estimated visit time in minutes. Return only valid JSON.',
            },
            {
                role: 'user',
                content: `Suggest top places to visit inside: "${regionName}".${excludeStr}\nReturn JSON:
{"places": [{"name": "Specific Place Name", "description": "What it is and why visit", "category": "beach|temple|museum|viewpoint|market|heritage|nature|food", "estimatedMinutes": 120}]}
Include 6-8 varied places. Names must be the actual attraction name, not the city.`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1200,
    });
    return JSON.parse(response.choices[0].message.content);
}

/**
 * Given two consecutive stops, suggest must-visit places between them.
 * Returns { suggestions: [{ name, description, category, estimatedMinutes }] }
 */
export async function getRouteMustVisits(fromName, toName, excludeNames = []) {
    const excludeStr = excludeNames.length ? `\nDo NOT suggest any of these places, we already saw them: ${excludeNames.join(', ')}` : '';
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'You are a road trip planner. Suggest 3-4 must-visit spots that are directly on or very close to the route between two places. Only suggest places that genuinely lie along this road corridor. Return only valid JSON.',
            },
            {
                role: 'user',
                content: `What are the must-visit stops between "${fromName}" and "${toName}" on a road trip?${excludeStr}\nReturn JSON:
{"suggestions": [{"name": "Place Name", "description": "Why stop here", "category": "beach|temple|viewpoint|food|nature|heritage", "estimatedMinutes": 60}]}`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 800,
    });
    return JSON.parse(response.choices[0].message.content);
}

export default openai;

