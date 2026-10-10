// src/components/ShareTripDialog.jsx
// "Share trip" — one dialog behind every Invite / Share button.
//
// Like sharing a sheet, the organiser picks what the link lets people do:
//   Can join      — the /join/<inviteCode> link adds them to the trip at once
//   Ask to join   — the plain trip link; they send a request, an organiser
//                   approves it here (or on the Members page)
//
// Only organisers hand out the direct link. Everyone else on the trip shares
// the request link, so the organiser stays in control of who gets in.
//
// A draft trip (not yet saved to a profile) has no members to add, so it just
// gets its link and a note on how to control access.
import { useState } from 'react';
import { Check, Copy, Clock, Link as LinkIcon, UserPlus } from 'lucide-react';
import Modal from './Modal';
import JoinRequestsList from './JoinRequestsList';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { isTripClaimed } from '../utils/draftTrips';

/** True when the signed-in user organises this trip (and so approves requests). */
export function useIsTripOrganiser() {
    const { selectedTrip, members } = useTrip();
    const { user } = useAuth();
    if (!user || !selectedTrip) return false;
    if (selectedTrip.createdBy === user.uid) return true;
    return members.some(m => m.uid === user.uid && (m.role === 'admin' || m.role === 'owner'));
}

const MODES = [
    {
        id: 'join',
        icon: UserPlus,
        label: 'Anyone with the link can join',
        hint: 'They’re added to the trip as soon as they open it.',
    },
    {
        id: 'request',
        icon: Clock,
        label: 'Anyone with the link can ask to join',
        hint: 'You approve each person before they can see chat, expenses and polls.',
    },
];

export default function ShareTripDialog({ open, onClose }) {
    const { selectedTrip: trip, joinRequests } = useTrip();
    const isOrganiser = useIsTripOrganiser();
    const [mode, setMode] = useState('request');
    const [copied, setCopied] = useState(false);

    if (!trip) return null;

    const origin = window.location.origin;
    const claimed = isTripClaimed(trip);
    const canDirect = claimed && isOrganiser && !!trip.inviteCode;
    const activeMode = canDirect ? mode : 'request';
    const url = claimed && activeMode === 'join'
        ? `${origin}/join/${trip.inviteCode}`
        : `${origin}/trip/${trip.id}`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked — the field is selectable */ }
    };


    return (
        <Modal open={open} onClose={onClose} title={`Share “${trip.name}”`} size="md">
            {claimed ? (
                <>
                    <p className="share-section-label">Link access</p>
                    <div className="share-modes" role="radiogroup" aria-label="What the link lets people do">
                        {MODES.map(m => {
                            const disabled = m.id === 'join' && !canDirect;
                            const Icon = m.icon;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={activeMode === m.id}
                                    disabled={disabled}
                                    className={`share-mode${activeMode === m.id ? ' is-active' : ''}`}
                                    onClick={() => { setMode(m.id); setCopied(false); }}
                                >
                                    <span className="share-mode-icon" aria-hidden="true"><Icon size={17} /></span>
                                    <span className="share-mode-text">
                                        <span className="share-mode-label">{m.label}</span>
                                        <span className="share-mode-hint">
                                            {disabled ? 'Only the trip’s organiser can share a direct-join link.' : m.hint}
                                        </span>
                                    </span>
                                    <span className="share-mode-radio" aria-hidden="true" />
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <p className="share-note">
                    This trip is still a draft, so anyone with the link can view and edit it.
                    Save it to your profile from the Itinerary tab to choose who can join.
                </p>
            )}

            <div className="share-link-row">
                <span className="share-link-icon" aria-hidden="true"><LinkIcon size={15} /></span>
                <input readOnly value={url} onFocus={e => e.target.select()} aria-label="Share link" className="share-link-input" />
                <button type="button" className="btn btn-primary btn-md" onClick={copy} style={{ whiteSpace: 'nowrap' }}>
                    {copied ? <><Check size={15} aria-hidden="true" /> Copied</> : <><Copy size={15} aria-hidden="true" /> Copy link</>}
                </button>
            </div>


            {claimed && isOrganiser && (
                <div className="share-requests">
                    <p className="share-section-label">
                        Requests to join{joinRequests.length > 0 && <span className="share-count">{joinRequests.length}</span>}
                    </p>
                    <JoinRequestsList emptyText="No one is waiting. Requests from the ask-to-join link show up here." />
                </div>
            )}
        </Modal>
    );
}
