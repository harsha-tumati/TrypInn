// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { firebaseConfigured } from '../config/firebaseConfig';
import { readAuthHint, writeAuthHint } from '../utils/authHint';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(firebaseConfigured);
    // Who was signed in last time, so the navbar can show the account straight
    // away instead of waiting for Firebase. Read in a layout effect so the
    // first render still matches the prerendered (signed-out) homepage HTML.
    const [authHint, setAuthHint] = useState(null);
    useLayoutEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- must run after hydration, before paint
        setAuthHint(readAuthHint());
    }, []);

    const ensureUserProfile = useCallback(async (db, firebaseUser) => {
        const { doc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            const profile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Traveler',
                email: firebaseUser.email,
                photoURL: firebaseUser.photoURL || null,
                createdAt: serverTimestamp(),
            };
            await setDoc(userRef, profile);
            return profile;
        }
        return snap.data();
    }, []);

    useEffect(() => {
        if (!firebaseConfigured) return;

        let unsubscribe = null;
        let cancelled = false;
        let idleId = null;

        const startAuth = async () => {
            const [{ auth, db, googleProvider }, { onAuthStateChanged }] = await Promise.all([
                import('../config/firebase').then((m) => m.getFirebase()),
                import('firebase/auth'),
            ]);
            if (cancelled) return;

            unsubscribe = onAuthStateChanged(
                auth,
                async (firebaseUser) => {
                    if (cancelled) return;
                    if (firebaseUser) {
                        setUser(firebaseUser);
                        try {
                            const profile = await ensureUserProfile(db, firebaseUser);
                            if (cancelled) return;
                            setUserProfile(profile);
                            const hint = {
                                uid: firebaseUser.uid,
                                name: profile?.name || firebaseUser.displayName || '',
                                email: profile?.email || firebaseUser.email || '',
                            };
                            writeAuthHint(hint);
                            setAuthHint(hint);
                        } catch (e) {
                            if (import.meta.env.DEV) console.error('Failed to load user profile:', e);
                            setUserProfile(null);
                        }
                    } else {
                        setUser(null);
                        setUserProfile(null);
                        writeAuthHint(null);
                        setAuthHint(null);
                    }
                    setLoading(false);
                },
                (error) => {
                    if (cancelled) return;
                    if (import.meta.env.DEV) console.error('Auth listener error:', error);
                    setUser(null);
                    setUserProfile(null);
                    setLoading(false);
                }
            );
        };

        // Returning signed-in users need Firebase for everything they see, so
        // start it right away. Everyone else defers it until the browser is
        // idle — this keeps the main thread free during initial paint and
        // improves TBT on mobile (the Firebase chunk is ~500KB).
        if (readAuthHint()) {
            startAuth();
        } else {
            const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
            idleId = scheduleIdle(startAuth, { timeout: 3000 });
        }

        return () => {
            cancelled = true;
            if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
            else clearTimeout(idleId);
            if (unsubscribe) unsubscribe();
        };
    }, [ensureUserProfile]);

    const signInWithGoogle = useCallback(async () => {
        const [{ auth, googleProvider }, { signInWithPopup }] = await Promise.all([
            import('../config/firebase').then((m) => m.getFirebase()),
            import('firebase/auth'),
        ]);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            if (import.meta.env.DEV) console.error('Google Sign-In error:', error);
            throw error;
        }
    }, []);

    const signOut = useCallback(async () => {
        const [{ auth }, { signOut: firebaseSignOut }] = await Promise.all([
            import('../config/firebase').then((m) => m.getFirebase()),
            import('firebase/auth'),
        ]);
        try {
            await firebaseSignOut(auth);
            writeAuthHint(null);
            setAuthHint(null);
        } catch (error) {
            if (import.meta.env.DEV) console.error('Sign-out error:', error);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, authHint, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
