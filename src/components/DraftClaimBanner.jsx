// src/components/DraftClaimBanner.jsx
// "This trip is a draft — Add to my profile", shown at the top of the Plan
// and Itinerary tabs.
//
// A trip is created anonymously as a draft. Claiming it to a profile is what
// unlocks the collaborative tabs (Expenses, Chat, Polls). Without an account
// the button goes to login first, and the claim finishes by itself once the
// traveller is back on this tab (`returnTo`).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookmarkPlus } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { claimTrip } from '../services/firestoreService';
import { isTripClaimed, removeDraftId } from '../utils/draftTrips';

const PENDING = 'trypinn_claim';

export default function DraftClaimBanner({ returnTo }) {
    const { selectedTrip, setSelectedTrip } = useTrip();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [claiming, setClaiming] = useState(false);
    const [claimError, setClaimError] = useState('');
    const isDraft = !!selectedTrip && !isTripClaimed(selectedTrip);

    async function handleClaim() {
        if (!selectedTrip || claiming) return;
        // Saving to a profile needs an account — bounce to login, then resume
        // the claim automatically once the user lands back on this page.
        if (!user) {
            try { sessionStorage.setItem(PENDING, selectedTrip.id); } catch { /* storage unavailable */ }
            navigate('/login', { state: { from: returnTo || `/trip/${selectedTrip.id}` } });
            return;
        }
        setClaiming(true);
        setClaimError('');
        try {
            await claimTrip(selectedTrip.id, user.uid);
            removeDraftId(selectedTrip.id);
            setSelectedTrip({ ...selectedTrip, claimed: true, createdBy: user.uid });
        } catch (e) {
            setClaimError(e.message || 'Could not save this trip. Please try again.');
        } finally {
            setClaiming(false);
        }
    }

    // Resume a pending claim after the user signs in (see handleClaim).
    useEffect(() => {
        if (!user || !selectedTrip) return;
        let pending = null;
        try { pending = sessionStorage.getItem(PENDING); } catch { /* storage unavailable */ }
        if (pending !== selectedTrip.id || isTripClaimed(selectedTrip)) return;
        try { sessionStorage.removeItem(PENDING); } catch { /* storage unavailable */ }
        (async () => {
            try {
                await claimTrip(selectedTrip.id, user.uid);
                removeDraftId(selectedTrip.id);
                setSelectedTrip({ ...selectedTrip, claimed: true, createdBy: user.uid });
            } catch (e) {
                console.error('Auto-claim failed', e);
            }
        })();
    }, [user, selectedTrip, setSelectedTrip]);

    if (!isDraft) return null;
    return (
        <div className="claim-banner">
            <div className="claim-banner-text">
                <div className="claim-banner-title">
                    <Sparkles size={16} aria-hidden="true" /> This trip is a draft
                </div>
                <p>Save it to your profile to unlock group expenses, chat and polls — and keep it synced across your devices.</p>
                {claimError && <p className="claim-banner-error">{claimError}</p>}
            </div>
            <button type="button" className="claim-banner-btn" onClick={handleClaim} disabled={claiming}>
                {claiming
                    ? <div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} aria-hidden="true" />
                    : <><BookmarkPlus size={16} aria-hidden="true" /> Add to my profile</>}
            </button>
        </div>
    );
}
