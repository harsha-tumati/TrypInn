// src/components/BottomSheet.jsx
// A draggable bottom sheet with three snap points: peek / half / full.
// Controlled — the parent owns `snap` and gets `onSnapChange` callbacks.
// Drag the grip to resize; tap the grip to toggle full/half.
import { useRef, useState } from 'react';

const PEEK = 96;
const ORDER = ['peek', 'half', 'full'];

export default function BottomSheet({ snap, onSnapChange, children }) {
    const rootRef = useRef(null);
    const dragRef = useRef(null);
    const [dragHeight, setDragHeight] = useState(null);

    // Snap heights in px, derived from the sheet's positioning parent.
    const heightsFor = () => {
        const parent = rootRef.current?.parentElement;
        const H = parent ? parent.clientHeight : window.innerHeight;
        return { peek: PEEK, half: Math.round(H * 0.5), full: Math.round(H * 0.88) };
    };

    const onDown = (e) => {
        const heights = heightsFor();
        dragRef.current = { y: e.clientY, h: heights[snap] || heights.half, heights, live: null, moved: false };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
        const d = dragRef.current;
        if (!d) return;
        const delta = d.y - e.clientY;
        if (Math.abs(delta) > 5) d.moved = true;
        const h = Math.min(d.heights.full, Math.max(d.heights.peek, d.h + delta));
        d.live = h;
        setDragHeight(h);
    };
    const onUp = () => {
        const d = dragRef.current;
        if (!d) return;
        dragRef.current = null;
        setDragHeight(null);
        if (!d.moved) {
            // A tap toggles between full and half.
            onSnapChange(snap === 'full' ? 'half' : 'full');
            return;
        }
        const cur = d.live ?? d.h;
        let best = 'half';
        let bestDist = Infinity;
        for (const k of ORDER) {
            const dist = Math.abs(d.heights[k] - cur);
            if (dist < bestDist) { bestDist = dist; best = k; }
        }
        onSnapChange(best);
    };
    const onKey = (e) => {
        const i = ORDER.indexOf(snap);
        if (e.key === 'ArrowUp' && i < ORDER.length - 1) { e.preventDefault(); onSnapChange(ORDER[i + 1]); }
        else if (e.key === 'ArrowDown' && i > 0) { e.preventDefault(); onSnapChange(ORDER[i - 1]); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSnapChange(snap === 'full' ? 'half' : 'full'); }
    };

    const dragging = dragHeight != null;
    const height = dragging
        ? `${dragHeight}px`
        : snap === 'peek' ? `${PEEK}px` : snap === 'full' ? '88%' : '50%';

    return (
        <div ref={rootRef} className={`bottom-sheet${dragging ? ' dragging' : ''}`} style={{ height }}>
            <div
                className="bottom-sheet-grip"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={onKey}
                role="button"
                tabIndex={0}
                aria-label="Resize panel — drag, or use the arrow keys"
            >
                <span className="bottom-sheet-bar" />
            </div>
            {children}
        </div>
    );
}
