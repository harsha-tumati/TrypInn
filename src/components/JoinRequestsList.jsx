// src/components/JoinRequestsList.jsx
// People who asked to join the trip, with Approve / Decline for the organiser.
// Used in the share dialog and on the Members page.
import { useState } from 'react';
import { Check, X, Loader } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { approveJoinRequest, declineJoinRequest } from '../services/firestoreService';

function timeAgo(ts) {
    const ms = ts?.toMillis ? ts.toMillis() : null;
    if (!ms) return 'just now';
    const mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function JoinRequestsList({ emptyText }) {
    const { selectedTrip, joinRequests } = useTrip();
    const [busy, setBusy] = useState({}); // uid -> 'approve' | 'decline'
    const [error, setError] = useState('');

    if (!joinRequests.length) {
        return emptyText ? <p className="join-requests-empty">{emptyText}</p> : null;
    }

    const act = async (uid, action) => {
        setBusy(b => ({ ...b, [uid]: action }));
        setError('');
        try {
            if (action === 'approve') await approveJoinRequest(selectedTrip.id, uid);
            else await declineJoinRequest(selectedTrip.id, uid);
            // The live members listener moves them out of this list.
        } catch (e) {
            setError(e?.message || 'That didn’t go through. Please try again.');
        } finally {
            setBusy(b => { const next = { ...b }; delete next[uid]; return next; });
        }
    };

    return (
        <>
            <ul className="join-requests">
                {joinRequests.map(r => {
                    const name = r.name || r.displayName || r.email || 'Traveler';
                    return (
                        <li key={r.uid} className="join-request">
                            <span className="join-request-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                            <span className="join-request-text">
                                <span className="join-request-name">{name}</span>
                                <span className="join-request-meta">{r.email && r.email !== name ? `${r.email} · ` : ''}asked {timeAgo(r.requestedAt)}</span>
                            </span>
                            <span className="join-request-actions">
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(r.uid, 'decline')} disabled={!!busy[r.uid]} aria-label={`Decline ${name}`}>
                                    {busy[r.uid] === 'decline' ? <Loader size={14} className="tp-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />} Decline
                                </button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => act(r.uid, 'approve')} disabled={!!busy[r.uid]} aria-label={`Approve ${name}`}>
                                    {busy[r.uid] === 'approve' ? <Loader size={14} className="tp-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Approve
                                </button>
                            </span>
                        </li>
                    );
                })}
            </ul>
            {error && <p className="tp-error" role="alert">{error}</p>}
        </>
    );
}
