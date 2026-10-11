// src/components/MapCamera.jsx
// Keeps the trip map framed like Google Maps does: whenever the set of things
// on screen changes (stops, the drawn route, AI or nearby results) the camera
// glides to fit all of them, leaving room for the bottom sheet and the floating
// controls. Long jumps arc out and back in; short ones just pan and zoom.
//
// Must be rendered inside <Map>. Renders nothing.
import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

const TILE = 256;
const MAX_FIT_ZOOM = 15;  // never zoom in further than this to fit a set
const SINGLE_ZOOM = 13;   // one point on its own
const FOCUS_ZOOM = 14;    // "show on map" for a single stop

// Web Mercator, normalised to [0, 1].
const toWorld = ({ lat, lng }) => {
    const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
    return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
};
const fromWorld = ({ x, y }) => ({
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
    lng: x * 360 - 180,
});

const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

// Space covered by the sheet and floating controls, in px from each edge.
function overlayPadding(mapDiv) {
    const box = mapDiv.getBoundingClientRect();
    const pad = { top: 24, right: 24, bottom: 24, left: 24 };
    const root = mapDiv.closest('.tm-root') || document;
    for (const el of root.querySelectorAll('.tm-controls, .tm-nav-status, .tm-toast')) {
        const r = el.getBoundingClientRect();
        if (r.height && r.bottom > box.top && r.top < box.top + box.height / 2) {
            pad.top = Math.max(pad.top, r.bottom - box.top + 20);
        }
    }
    const sheet = root.querySelector('.bottom-sheet');
    if (sheet) {
        const r = sheet.getBoundingClientRect();
        if (r.width < box.width * 0.6) pad.left = Math.max(pad.left, r.right - box.left + 28); // side panel
        else pad.bottom = Math.max(pad.bottom, box.bottom - r.top + 24);                         // bottom sheet
    }
    // Never let padding eat the whole map.
    const maxV = box.height * 0.42;
    const maxH = box.width * 0.42;
    pad.top = Math.min(pad.top, maxV);
    pad.bottom = Math.min(pad.bottom, maxV);
    pad.left = Math.min(pad.left, maxH);
    pad.right = Math.min(pad.right, maxH);
    return { pad, width: box.width, height: box.height };
}

// Camera (centre + zoom) that fits `points` inside the padded area.
function cameraFor(points, mapDiv, fractional, singleZoom = SINGLE_ZOOM) {
    const { pad, width, height } = overlayPadding(mapDiv);
    const w = points.map(toWorld);
    const minX = Math.min(...w.map((p) => p.x));
    const maxX = Math.max(...w.map((p) => p.x));
    const minY = Math.min(...w.map((p) => p.y));
    const maxY = Math.max(...w.map((p) => p.y));
    const availW = Math.max(60, width - pad.left - pad.right);
    const availH = Math.max(60, height - pad.top - pad.bottom);
    const dx = maxX - minX;
    const dy = maxY - minY;
    let zoom = dx < 1e-9 && dy < 1e-9
        ? singleZoom
        : Math.log2(Math.min(dx > 1e-9 ? availW / (dx * TILE) : Infinity, dy > 1e-9 ? availH / (dy * TILE) : Infinity));
    zoom = Math.max(2, Math.min(dx < 1e-9 && dy < 1e-9 ? singleZoom : MAX_FIT_ZOOM, zoom));
    zoom = fractional ? Math.floor(zoom * 20) / 20 : Math.floor(zoom);
    // Put the middle of the set in the middle of the *visible* area.
    const scale = TILE * 2 ** zoom;
    const cx = (minX + maxX) / 2 - (pad.left - pad.right) / 2 / scale;
    const cy = (minY + maxY) / 2 - (pad.top - pad.bottom) / 2 / scale;
    return { center: fromWorld({ x: cx, y: cy }), zoom };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export default function MapCamera({ points, fitKey, focus, focusKey, refitKey, fitNonce }) {
    const map = useMap();
    const animRef = useRef(0);
    const userMovedRef = useRef(false);
    const firstFitRef = useRef(true);
    const pointsRef = useRef(points);
    // Declared first so it runs before the fit effects below.
    useEffect(() => { pointsRef.current = points; });

    // Remember when the person moves the map themselves, so layout changes
    // (like resizing the sheet) don't yank the view away from them.
    useEffect(() => {
        if (!map) return;
        const div = map.getDiv();
        const mark = () => { userMovedRef.current = true; cancelAnimationFrame(animRef.current); };
        const pinch = (e) => { if (e.touches.length > 1) mark(); };
        const drag = map.addListener('dragstart', mark);
        div.addEventListener('wheel', mark, { passive: true });
        div.addEventListener('touchstart', pinch, { passive: true });
        return () => {
            drag.remove();
            div.removeEventListener('wheel', mark);
            div.removeEventListener('touchstart', pinch);
        };
    }, [map]);

    const flyTo = (target, instant = false) => {
        if (!map) return;
        cancelAnimationFrame(animRef.current);
        const vector = map.getRenderingType?.() === 'VECTOR';
        const start = { center: map.getCenter()?.toJSON(), zoom: map.getZoom() };
        if (instant || !start.center || start.zoom == null) {
            map.moveCamera(target);
            return;
        }
        if (!vector) {
            // Raster maps only draw whole zoom levels: let Google animate the
            // pan, then step the zoom one level at a time so it still glides.
            map.panTo(target.center);
            let z = Math.round(start.zoom);
            const step = () => {
                if (z === target.zoom) { map.panTo(target.center); return; }
                z += z < target.zoom ? 1 : -1;
                map.setZoom(z);
                animRef.current = requestAnimationFrame(() => setTimeout(step, 90));
            };
            animRef.current = requestAnimationFrame(() => setTimeout(step, 220));
            return;
        }
        // Vector maps: interpolate centre and zoom, arcing out for long jumps.
        const a = toWorld(start.center);
        const b = toWorld(target.center);
        const distPx = Math.hypot(b.x - a.x, b.y - a.y) * TILE * 2 ** Math.min(start.zoom, target.zoom);
        const lift = Math.max(0, Math.log2(distPx / 900));
        const duration = Math.min(1500, 600 + lift * 180 + Math.abs(target.zoom - start.zoom) * 60);
        const t0 = performance.now();
        const frame = (now) => {
            const t = Math.min(1, (now - t0) / duration);
            const k = ease(t);
            const zoom = start.zoom + (target.zoom - start.zoom) * k - lift * Math.sin(Math.PI * t);
            // Move in screen space at the current zoom so the glide looks even.
            const center = fromWorld({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
            map.moveCamera({ center, zoom });
            if (t < 1) animRef.current = requestAnimationFrame(frame);
        };
        animRef.current = requestAnimationFrame(frame);
    };

    const fitAll = (instant = false) => {
        if (!map) return;
        const pts = pointsRef.current.filter(valid);
        if (!pts.length) return;
        const vector = map.getRenderingType?.() === 'VECTOR';
        flyTo(cameraFor(pts, map.getDiv(), vector), instant);
        userMovedRef.current = false;
    };

    // Whatever is on the map changed → show all of it. The first fit is
    // instant so the map opens already framed.
    useEffect(() => {
        if (!map) return;
        // Wait a frame so the sheet and controls have laid out.
        const id = requestAnimationFrame(() => {
            fitAll(firstFitRef.current);
            firstFitRef.current = false;
        });
        return () => cancelAnimationFrame(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, fitKey, fitNonce]);

    // The sheet moved (peek / half / full): re-frame, unless the person has
    // panned or zoomed the map themselves since the last fit.
    useEffect(() => {
        if (!map || firstFitRef.current) return;
        // Let the sheet finish its 340ms height transition first.
        const t = setTimeout(() => { if (!userMovedRef.current) fitAll(); }, 380);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, refitKey]);

    // A single stop was picked: glide to it.
    useEffect(() => {
        if (!map || !valid(focus)) return;
        const vector = map.getRenderingType?.() === 'VECTOR';
        const zoom = Math.max(map.getZoom() || 0, FOCUS_ZOOM);
        flyTo(cameraFor([focus], map.getDiv(), vector, zoom));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, focusKey]);

    useEffect(() => () => cancelAnimationFrame(animRef.current), []);

    return null;
}
