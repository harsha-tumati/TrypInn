// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { firebaseConfigured } from '../config/firebaseConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(firebaseConfigured);

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
                            setUserProfile(await ensureUserProfile(db, firebaseUser));
                        } catch (e) {
                            if (import.meta.env.DEV) console.error('Failed to load user profile:', e);
                            setUserProfile(null);
                        }
                    } else {
                        setUser(null);
                        setUserProfile(null);
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

        // Defer Firebase auth init until the browser is idle — this keeps the
        // main thread free during initial paint and dramatically improves TBT
        // on mobile (where the 500KB Firebase chunk would otherwise jank).
        const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
        idleId = scheduleIdle(startAuth, { timeout: 3000 });

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
        } catch (error) {
            if (import.meta.env.DEV) console.error('Sign-out error:', error);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
