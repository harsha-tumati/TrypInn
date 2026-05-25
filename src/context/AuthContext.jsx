// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db, googleProvider, firebaseConfigured } from '../config/firebase';
import {
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    // Start "loading" only when there is a real Firebase config to wait on;
    // otherwise the app resolves immediately in a signed-out state.
    const [loading, setLoading] = useState(firebaseConfigured);

    const ensureUserProfile = useCallback(async (firebaseUser) => {
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
        // No real Firebase config — don't attach a listener that can't
        // resolve. Initial state (signed-out, not loading) already reflects it.
        if (!firebaseConfigured) return;

        const unsubscribe = onAuthStateChanged(
            auth,
            async (firebaseUser) => {
                if (firebaseUser) {
                    setUser(firebaseUser);
                    try {
                        setUserProfile(await ensureUserProfile(firebaseUser));
                    } catch (e) {
                        console.error('Failed to load user profile:', e);
                        setUserProfile(null);
                    }
                } else {
                    setUser(null);
                    setUserProfile(null);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Auth listener error:', error);
                setUser(null);
                setUserProfile(null);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [ensureUserProfile]);

    const signInWithGoogle = useCallback(async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Google Sign-In error:', error);
            throw error;
        }
    }, []);

    const signOut = useCallback(async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Sign-out error:', error);
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
