// src/utils/dateHelpers.js
// Uses the built-in Intl/Date APIs instead of date-fns — same output formats,
// zero added bundle weight (date-fns was ~46 kB and sat on the homepage path).

// Parse a date value. Plain "YYYY-MM-DD" is treated as LOCAL midnight (like
// date-fns parseISO), so the displayed day doesn't shift in negative timezones.
function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(value + 'T00:00:00');
    }
    return new Date(value);
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const TIME_FMT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

// "MMM d, yyyy" — e.g. "Jun 3, 2026"
export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        return DATE_FMT.format(toDate(dateString));
    } catch {
        return dateString;
    }
}

// Inclusive day count between two dates (min 1).
export function tripDuration(startDate, endDate) {
    if (!startDate || !endDate) return 1;
    const diffMs = toDate(endDate).getTime() - toDate(startDate).getTime();
    const diffDays = Math.round(diffMs / 86400000);
    return Math.max(1, diffDays + 1);
}

// "h:mm a" — e.g. "3:05 PM"
export function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return TIME_FMT.format(date);
}
