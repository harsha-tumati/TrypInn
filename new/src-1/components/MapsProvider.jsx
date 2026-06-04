// src/components/MapsProvider.jsx
// Mounts the Google Maps APIProvider only when a key is configured. Without a
// key, rendering APIProvider injects a broken Maps script and triggers Google's
// "This page can't load Google Maps correctly" alert — so we skip it entirely.
// Descendants that call useMapsLibrary() simply receive null and degrade.
import React from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MAPS_KEY, MAPS_ENABLED } from '../config/maps';

export default function MapsProvider({ children }) {
    if (!MAPS_ENABLED) return <>{children}</>;
    return <APIProvider apiKey={MAPS_KEY}>{children}</APIProvider>;
}
