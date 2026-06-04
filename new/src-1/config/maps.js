// src/config/maps.js — single source of truth for Google Maps availability.
// When no key is configured we must NOT mount Google's script: doing so pops
// the "This page can't load Google Maps correctly" alert. Map-dependent UI
// reads MAPS_ENABLED and degrades to plain inputs instead.
export const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
export const MAPS_ENABLED = MAPS_KEY.length > 0;
