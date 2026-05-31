// src/config/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const rawConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
};

// True only when the essential Firebase keys are present.
export const firebaseConfigured = Boolean(rawConfig.apiKey && rawConfig.projectId && rawConfig.appId);

if (!firebaseConfigured) {
    // Without a real config, getAuth() throws `auth/invalid-api-key` at module
    // load — which would crash the whole app to a blank screen. We fall back
    // to harmless placeholders so the UI still renders; auth/Firestore calls
    // simply won't succeed until a real .env is provided.
    console.warn(
        '[Trypinn] Firebase is not configured. Create a .env file with your ' +
        'VITE_FIREBASE_* keys (see .env.example). Auth and data sync are disabled until then.'
    );
}

const firebaseConfig = firebaseConfigured
    ? rawConfig
    : {
        apiKey: 'tripsync-placeholder-key',
        authDomain: 'trypinn.firebaseapp.com',
        projectId: 'tripsync-placeholder',
        storageBucket: 'tripsync-placeholder.appspot.com',
        messagingSenderId: '000000000000',
        appId: '1:000000000000:web:0000000000000000000000',
    };

// Prevent re-initialization in hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
