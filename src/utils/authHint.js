// A small, local-only note of who was signed in on this device, so the UI can
// show the account immediately on the next visit while Firebase (a ~500KB
// chunk) loads and confirms the session. Firebase stays the source of truth:
// the hint is replaced or cleared as soon as it reports the real auth state.

const KEY = 'trypinn_auth_hint_v1';

export function readAuthHint() {
    try {
        const hint = JSON.parse(localStorage.getItem(KEY) || 'null');
        return hint && typeof hint.uid === 'string' ? hint : null;
    } catch {
        return null;
    }
}

export function writeAuthHint(hint) {
    if (!hint) document.documentElement.classList.remove('has-auth-hint');
    try {
        if (hint) localStorage.setItem(KEY, JSON.stringify(hint));
        else localStorage.removeItem(KEY);
    } catch {
        // Storage blocked (private mode) — the hint is only an optimisation.
    }
}
