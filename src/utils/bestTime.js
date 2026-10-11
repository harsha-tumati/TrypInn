// "Best time to visit" windows from the AI, stored on a place as a 24-hour
// "HH:MM-HH:MM" string (e.g. "06:00-08:00").

const toMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h <= 24 && min < 60 ? (h * 60 + min) % (24 * 60) : null;
};

/** { start, end } in minutes after midnight, or null when unreadable. */
export function parseBestTime(window) {
    const [a, b] = String(window || '').split(/\s*[-–]\s*/);
    const start = toMinutes(a);
    const end = toMinutes(b);
    return start == null || end == null ? null : { start, end };
}

const clock = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { label: `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}`, pm: h >= 12 };
};

/** "6–8 AM", "11:30 AM–1 PM", or '' when unreadable. */
export function formatBestTime(window) {
    const w = parseBestTime(window);
    if (!w) return '';
    const a = clock(w.start);
    const b = clock(w.end);
    return a.pm === b.pm
        ? `${a.label}–${b.label} ${b.pm ? 'PM' : 'AM'}`
        : `${a.label} ${a.pm ? 'PM' : 'AM'}–${b.label} ${b.pm ? 'PM' : 'AM'}`;
}

/** Whether a Date's time of day falls inside the window (handles windows past midnight). */
export function isWithinBestTime(window, date) {
    const w = parseBestTime(window);
    if (!w || !date) return null;
    const t = date.getHours() * 60 + date.getMinutes();
    return w.start <= w.end ? t >= w.start && t <= w.end : t >= w.start || t <= w.end;
}
