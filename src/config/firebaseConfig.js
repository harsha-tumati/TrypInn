// Lightweight config check — does NOT import Firebase, so it can be used
// without pulling the entire Firebase SDK into the initial chunk.
const env = import.meta.env;

export const firebaseConfigured = Boolean(
    env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID
);
