// src/config/openai.js
// The OpenAI API calls are now proxied through our backend (server.js)
// to prevent exposing the API key and to avoid CORS issues in production.
const openai = {
    get chat() {
        return {
            completions: {
                create: async (body) => {
                    const res = await fetch('/api/openai/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    });
                    
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || `OpenAI API error: ${res.statusText}`);
                    }
                    
                    const data = await res.json();
                    if (data.error) {
                        throw new Error(data.error.message || `OpenAI API error`);
                    }
                    return data;
                }
            }
        };
    },
};

/**
 * The JSON in an AI answer, in the shape the prompt asked for. Models don't
 * always follow the wrapper: asked for {"suggestions": [...]}, Gemini about
 * half the time sends just the [...] list, which read as "no suggestions"
 * and left the screen empty. So:
 *   listKey   — a bare list (or an object holding one other list) is put
 *               back under this key
 *   objectKey — an object missing this key is taken to be its contents
 * A stray ```json fence around the answer is ignored too.
 */
function readJson(response, { listKey, objectKey } = {}) {
    const raw = response.choices?.[0]?.message?.content || '';
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text);
    if (listKey) {
        if (Array.isArray(parsed)) return { [listKey]: parsed };
        if (parsed && !Array.isArray(parsed[listKey])) {
            const lists = Object.values(parsed).filter(Array.isArray);
            if (lists.length === 1) return { ...parsed, [listKey]: lists[0] };
        }
    }
    if (objectKey && parsed && !Array.isArray(parsed) && !(objectKey in parsed)) {
        return { [objectKey]: parsed };
    }
    return parsed;
}

/**
 * Get AI-powered destination suggestions using GPT-4o Mini.
 * Returns structured JSON: { places, food_places, hidden_gems }
 */
export async function getSuggestions(destination, exclude = []) {
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
Include at least 5 places, 4 food places, and 3 hidden gems. Always include the city name in the "name" field.${exclude.length ? `
Already in the trip, so do not suggest these again: ${exclude.join('; ')}.` : ''}`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
    });

    return readJson(response);
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

    return readJson(response);
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

    return readJson(response, { listKey: 'en_route_places' });
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

    const parsed = readJson(response, { listKey: 'places' });
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
{"places": [{"name": "Specific Place Name", "description": "What it is and why visit", "category": "beach|temple|museum|viewpoint|market|heritage|nature|food", "estimatedMinutes": 120, "bestTime": "06:00-08:00", "bestTimeReason": "Short reason, max 8 words"}]}
Include 6-8 varied places. Names must be the actual attraction name, not the city.
bestTime is the best time of day to be there, as a 24-hour "HH:MM-HH:MM" window within opening hours (e.g. sunrise beaches early, markets in the evening, museums mid-morning).`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1600,
    });
    return readJson(response, { listKey: 'places' });
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
{"suggestions": [{"name": "Place Name", "description": "Why stop here", "category": "beach|temple|viewpoint|food|nature|heritage", "estimatedMinutes": 60, "bestTime": "16:00-18:00", "bestTimeReason": "Short reason, max 8 words"}]}
bestTime is the best time of day to be there, as a 24-hour "HH:MM-HH:MM" window within opening hours.`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
    });
    return readJson(response, { listKey: 'suggestions' });
}

export default openai;

/**
 * Best time of day to visit each place, for places suggested before the
 * suggestion prompts asked for it.
 * Returns { times: { [name]: { bestTime: "HH:MM-HH:MM", reason } } }
 */
export async function getBestVisitTimes(places, area = '') {
    const list = places.map(p => `- ${p.name}${p.category ? ` (${p.category})` : ''}`).join('\n');
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'You are a local travel expert. For each place, give the best time of day to visit, within its opening hours, as a 24-hour "HH:MM-HH:MM" window, with a reason of at most 8 words. Return only valid JSON.',
            },
            {
                role: 'user',
                content: `Places${area ? ` in or near ${area}` : ''}:\n${list}\nReturn JSON: {"times": {"Exact Place Name": {"bestTime": "06:00-08:00", "reason": "Sunrise over the bay"}}}`,
            },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 700,
    });
    return readJson(response, { objectKey: 'times' });
}
