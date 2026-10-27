// ai-proxy.js — forwards the app's AI requests (POST /api/openai/chat) to
// whichever provider has a key. Used by server.js in production and by the
// dev server in vite.config.js.
//
// The app speaks OpenAI's chat-completions format. Google Gemini accepts the
// same format, and its free tier covers testing at no cost, so it's used
// whenever GEMINI_API_KEY is set; OpenAI is the fallback.
//
//   GEMINI_API_KEY      → Gemini (from aistudio.google.com)
//   GEMINI_MODEL        → model for everyday calls  (default gemini-flash-lite-latest)
//   GEMINI_MODEL_SMART  → model for the app's "gpt-4o" calls (default: GEMINI_MODEL)
//   OPENAI_API_KEY      → OpenAI, used only without a Gemini key
//
// The "-latest" name follows Google's current Flash-Lite, so a retired
// version (2.5 went away for new keys in 2026) doesn't break the app. The
// full Flash model was too slow for the app's prompts (no answer in 60 s);
// Flash-Lite answers them in a second or two.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * The request to send upstream for an app request body, or an error when no
 * provider is configured. `env` is process.env (or Vite's loadEnv result).
 */
export function aiUpstream(body, env) {
    const gemini = env.GEMINI_API_KEY;
    if (gemini) {
        // The app asks for OpenAI models by name; "gpt-4o" is its one heavy call.
        const smart = /^gpt-4o$/.test(body.model || '');
        const everyday = env.GEMINI_MODEL || 'gemini-flash-lite-latest';
        const model = smart ? env.GEMINI_MODEL_SMART || everyday : everyday;
        return { url: GEMINI_URL, key: gemini, body: { ...body, model }, provider: 'gemini' };
    }
    const openai = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;
    if (openai) return { url: OPENAI_URL, key: openai, body, provider: 'openai' };
    return { error: 'No AI key configured. Set GEMINI_API_KEY (or OPENAI_API_KEY) in .env.' };
}

/**
 * Sends the request and returns { status, json } — the provider's response,
 * in OpenAI's format either way.
 */
export async function forwardAi(body, env) {
    const up = aiUpstream(body, env);
    if (up.error) return { status: 500, json: { error: up.error } };
    // Gemini's free tier sometimes answers "too many requests" (429) or
    // "overloaded" (503) for a moment, e.g. when the app asks several things
    // at once. Two short retries ride that out instead of failing the screen.
    let res;
    for (let attempt = 0; ; attempt++) {
        res = await fetch(up.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${up.key}` },
            body: JSON.stringify(up.body),
        });
        if (![429, 500, 503].includes(res.status) || attempt === 2) break;
        console.warn(`[ai proxy] ${up.provider} ${res.status}, retrying`);
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { error: `AI provider returned ${res.status}` }; }
    // Gemini wraps errors in an array; hand the app the usual { error } shape.
    if (Array.isArray(json)) json = json[0] || { error: `AI provider returned ${res.status}` };
    if (!res.ok) console.error(`[ai proxy] ${up.provider} ${res.status}`, JSON.stringify(json).slice(0, 300));
    return { status: res.status, json };
}
