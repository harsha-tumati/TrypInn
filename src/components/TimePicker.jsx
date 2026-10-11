// src/components/TimePicker.jsx
// A time picker that behaves like a clock, not like the browser's segmented
// <input type="time">, where changing 11 to 12 kept "AM" and jumped the time
// to just past midnight — and every keystroke re-planned the whole day.
//
//   • ▲/▼ on the hour move by an hour, so 11 AM → 12 PM → 1 PM.
//   • ▲/▼ on the minutes move by 5, carrying into the hour.
//   • Typing an hour picks AM or PM by whichever is nearer the current time
//     (11:54 AM, type 12 → 12:54 PM; type 9 → 9:54 AM).
//   • Nothing changes until "Set" (or Enter). Esc or a click outside cancels.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

const DAY = 24 * 60;
const wrap = (mins) => ((mins % DAY) + DAY) % DAY;
const parse = (hhmm) => {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return wrap((h || 0) * 60 + (m || 0));
};
const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const hour12 = (mins) => ((Math.floor(mins / 60) + 11) % 12) + 1;
const isPM = (mins) => mins >= 12 * 60;
const formatTime12 = (hhmm) => {
    const mins = parse(hhmm);
    return `${String(hour12(mins)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${isPM(mins) ? 'PM' : 'AM'}`;
};

export default function TimePicker({ value, onChange, label, title, className = '', onReset, resetLabel }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => parse(value));
    const [hourText, setHourText] = useState(null); // while typing the hour
    const [minText, setMinText] = useState(null);   // while typing the minutes
    const typingBase = useRef(null);
    const triggerRef = useRef(null);
    const popRef = useRef(null);
    const [pos, setPos] = useState(null);

    const openPicker = () => {
        setDraft(parse(value));
        setHourText(null);
        setMinText(null);
        setOpen(true);
    };
    const close = () => setOpen(false);
    const commit = () => {
        onChange(toHHMM(draft));
        setOpen(false);
    };

    // Sit under the trigger (or above it near the bottom of the screen),
    // kept inside the viewport, following it as the page scrolls.
    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const r = triggerRef.current?.getBoundingClientRect();
            const pop = popRef.current;
            if (!r || !pop) return;
            const w = pop.offsetWidth;
            const h = pop.offsetHeight;
            const below = r.bottom + 8 + h <= window.innerHeight - 8;
            const top = below ? r.bottom + 8 : Math.max(8, r.top - 8 - h);
            const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
            setPos({ top, left });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (popRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
            close();
        };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); triggerRef.current?.focus(); } };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const step = (delta) => { setHourText(null); setMinText(null); setDraft((d) => wrap(d + delta)); };

    const typeHour = (text) => {
        const digits = text.replace(/\D/g, '').slice(0, 2);
        setHourText(digits);
        const h = parseInt(digits, 10);
        if (!(h >= 1 && h <= 12)) return;
        const base = typingBase.current ?? draft;
        const mm = base % 60;
        const am = (h % 12) * 60 + mm;
        const pm = am + 12 * 60;
        // Nearer the time they started from; on a tie, the later one.
        const dist = (t) => Math.min(Math.abs(t - base), DAY - Math.abs(t - base));
        setDraft(dist(pm) <= dist(am) ? pm : am);
    };
    const typeMinute = (text) => {
        const digits = text.replace(/\D/g, '').slice(0, 2);
        setMinText(digits);
        const m = parseInt(digits, 10);
        if (m >= 0 && m <= 59) setDraft((d) => d - (d % 60) + m);
    };
    const onFieldKey = (e, unit) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); step(unit); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); step(-unit); }
    };
    const startTyping = (e) => { typingBase.current = draft; e.target.select(); };

    const pm = isPM(draft);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`tp-trigger ${className}`}
                onClick={() => (open ? close() : openPicker())}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={`${label}: ${formatTime12(value)}`}
                title={title}
            >
                {formatTime12(value)}
                <Clock size={14} aria-hidden="true" className="tp-trigger-icon" />
            </button>
            {open && createPortal(
                <div
                    ref={popRef}
                    className="tp-pop"
                    role="dialog"
                    aria-label={label}
                    style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
                >
                    <div className="tp-row">
                        <div className="tp-col">
                            <button type="button" className="tp-step" onClick={() => step(60)} aria-label="Later by an hour"><ChevronUp size={18} /></button>
                            <input
                                className="tp-field"
                                inputMode="numeric"
                                aria-label="Hour"
                                value={hourText ?? String(hour12(draft)).padStart(2, '0')}
                                onFocus={startTyping}
                                onBlur={() => setHourText(null)}
                                onChange={(e) => typeHour(e.target.value)}
                                onKeyDown={(e) => onFieldKey(e, 60)}
                                autoFocus
                            />
                            <button type="button" className="tp-step" onClick={() => step(-60)} aria-label="Earlier by an hour"><ChevronDown size={18} /></button>
                        </div>
                        <span className="tp-colon" aria-hidden="true">:</span>
                        <div className="tp-col">
                            <button type="button" className="tp-step" onClick={() => step(5)} aria-label="Later by 5 minutes"><ChevronUp size={18} /></button>
                            <input
                                className="tp-field"
                                inputMode="numeric"
                                aria-label="Minutes"
                                value={minText ?? String(draft % 60).padStart(2, '0')}
                                onFocus={startTyping}
                                onBlur={() => setMinText(null)}
                                onChange={(e) => typeMinute(e.target.value)}
                                onKeyDown={(e) => onFieldKey(e, 5)}
                            />
                            <button type="button" className="tp-step" onClick={() => step(-5)} aria-label="Earlier by 5 minutes"><ChevronDown size={18} /></button>
                        </div>
                        <div className="tp-ampm" role="group" aria-label="AM or PM">
                            <button type="button" className={!pm ? 'is-on' : ''} aria-pressed={!pm} onClick={() => pm && step(-12 * 60)}>AM</button>
                            <button type="button" className={pm ? 'is-on' : ''} aria-pressed={pm} onClick={() => !pm && step(12 * 60)}>PM</button>
                        </div>
                    </div>
                    <div className="tp-foot">
                        {onReset ? (
                            <button type="button" className="tp-reset" onClick={() => { onReset(); close(); }}>
                                <RotateCcw size={12} aria-hidden="true" /> {resetLabel || 'Reset'}
                            </button>
                        ) : <span />}
                        <div className="tp-actions">
                            <button type="button" className="tp-cancel" onClick={close}>Cancel</button>
                            <button type="button" className="tp-set" onClick={commit}>Set {formatTime12(toHHMM(draft))}</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
