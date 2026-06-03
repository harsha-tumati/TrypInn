// src/config/firebase.js
// Lazy Firebase initialization — the SDK is loaded dynamically so it doesn't
// bloat the initial JS bundle on the homepage.
import { firebaseConfigured as _fc } from './firebaseConfig';

export const firebaseConfigured = _fc;

const env = import.meta.env;

const rawConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfigured && import.meta.env.DEV) {
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
        projectId: 'trypync-placeholder',
        storageBucket: 'trypinn-placeholder.appspot.com',
        messagingSenderId: '000000000000',
        appId: '1:000000000000:web:0000000000000000000000',
    };

let _initPromise = null;

async function doInit() {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);
    const db = getFirestore(app);
    const googleProvider = new GoogleAuthProvider();

    return { app, auth, db, googleProvider };
}

export function getFirebase() {
    if (!_initPromise) _initPromise = doInit();
    return _initPromise;
}

export default getFirebase;
