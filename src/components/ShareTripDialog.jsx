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
//
// Changes to the link access and the public listing are staged, then saved
// with "Save changes" (closing the dialog discards them). The saved access
// is kept on the trip as `linkAccess`; with "ask to join" saved, direct-join
// links handed out earlier only let people ask (see GuestJoinBanner).
import { useState } from 'react';
import { Check, Copy, Clock, Globe, Link as LinkIcon, Loader, UserPlus } from 'lucide-react';
import Modal from './Modal';
import JoinRequestsList from './JoinRequestsList';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { isTripClaimed } from '../utils/draftTrips';
import { publicSummaryFor } from '../utils/publicTrips';
import { routeShapeFrom } from '../utils/routeShape';
import { setTripPublic, updateTrip } from '../services/firestoreService';

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
    const { selectedTrip: trip, joinRequests, places } = useTrip();
    const { userProfile } = useAuth();
    const isOrganiser = useIsTripOrganiser();
    // Unsaved choices; null means "as saved on the trip".
    const [draftMode, setDraftMode] = useState(null);
    const [draftPublic, setDraftPublic] = useState(null);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState('');

    if (!trip) return null;

    const origin = window.location.origin;
    const claimed = isTripClaimed(trip);
    const canDirect = claimed && isOrganiser && !!trip.inviteCode;
    const savedMode = trip.linkAccess === 'join' ? 'join' : 'request';
    const activeMode = canDirect ? (draftMode ?? savedMode) : 'request';
    const isPublic = draftPublic ?? !!trip.isPublic;
    const modeChanged = canDirect && activeMode !== savedMode;
    const publicChanged = isPublic !== !!trip.isPublic;
    const dirty = modeChanged || publicChanged;
    const url = claimed && activeMode === 'join'
        ? `${origin}/join/${trip.inviteCode}`
        : `${origin}/trip/${trip.id}`;

    const discard = () => { setDraftMode(null); setDraftPublic(null); setSaveError(''); };
    const close = () => { discard(); setSaved(false); onClose(); };

    // Write the staged changes. The live trip listener then reflects them
    // back, so the drafts can be cleared.
    const save = async () => {
        setSaving(true);
        setSaveError('');
        try {
            if (modeChanged) await updateTrip(trip.id, { linkAccess: activeMode });
            if (publicChanged) {
                await setTripPublic(trip.id, isPublic ? {
                    ...publicSummaryFor(places),
                    routeShape: routeShapeFrom(places),
                    organiserName: userProfile?.name || 'A Trypinn traveller',
                } : null);
            }
            discard();
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            return true;
        } catch (e) {
            setSaveError(e?.message || 'That didn’t go through. Please try again.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    // The copied link only works as described once its access is saved.
    const copy = async () => {
        if (modeChanged && !(await save())) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked — the field is selectable */ }
    };


    return (
        <Modal open={open} onClose={close} title={`Share “${trip.name}”`} size="md">
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
                                    onClick={() => { setDraftMode(m.id); setCopied(false); setSaved(false); }}
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
                <button type="button" className="btn btn-primary btn-md" onClick={copy} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
                    {copied ? <><Check size={15} aria-hidden="true" /> Copied</> : <><Copy size={15} aria-hidden="true" /> Copy link</>}
                </button>
            </div>


            {claimed && isOrganiser && (
                <div className="share-public">
                    <span className="share-mode-icon" aria-hidden="true"><Globe size={17} /></span>
                    <span className="share-mode-text">
                        <span className="share-mode-label">List on Public Trips</span>
                        <span className="share-mode-hint">
                            {isPublic
                                ? 'Shown on the home page and the Public Trips tab. People ask to join, and you approve them.'
                                : 'Show this trip on the home page so travellers can find it and ask to join. You approve everyone.'}
                        </span>
                    </span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isPublic}
                        aria-label="List this trip publicly"
                        className={`share-switch${isPublic ? ' is-on' : ''}`}
                        onClick={() => { setDraftPublic(!isPublic); setSaved(false); }}
                        disabled={saving}
                    >
                        <span className="share-switch-knob" aria-hidden="true" />
                    </button>
                </div>
            )}

            {claimed && isOrganiser && (
                <div className="share-footer">
                    <span className="share-footer-status" role="status">
                        {saveError
                            ? <span className="tp-error">{saveError}</span>
                            : dirty ? 'You have unsaved changes.'
                            : saved ? <><Check size={14} aria-hidden="true" /> Saved</> : null}
                    </span>
                    {dirty ? (
                        <>
                            <button type="button" className="btn btn-ghost btn-md" onClick={discard} disabled={saving}>Discard</button>
                            <button type="button" className="btn btn-primary btn-md" onClick={save} disabled={saving}>
                                {saving ? <Loader size={15} className="tp-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} Save changes
                            </button>
                        </>
                    ) : (
                        <button type="button" className="btn btn-secondary btn-md" onClick={close}>Done</button>
                    )}
                </div>
            )}
            {claimed && !isOrganiser && trip.isPublic && (
                <p className="share-note share-note-info">This trip is listed on Public Trips.</p>
            )}

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
