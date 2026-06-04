// src/context/GuestModeContext.jsx
// Provides `isGuest` to any component inside a trip workspace.
// A guest is someone who arrived via an invite link (?invite=) and has not
// yet joined the trip. Guests can VIEW everything but cannot EDIT.
import React, { createContext, useContext } from 'react';

const GuestModeContext = createContext(false);

export function GuestModeProvider({ isGuest, children }) {
    return (
        <GuestModeContext.Provider value={isGuest}>
            {children}
        </GuestModeContext.Provider>
    );
}

export function useGuestMode() {
    return useContext(GuestModeContext);
}
