// src/utils/dateHelpers.js
import { format, parseISO, differenceInDays } from 'date-fns';

export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
        return dateString;
    }
}

export function tripDuration(startDate, endDate) {
    if (!startDate || !endDate) return 1;
    const diff = differenceInDays(parseISO(endDate), parseISO(startDate));
    return Math.max(1, diff + 1);
}

export function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'h:mm a');
}
