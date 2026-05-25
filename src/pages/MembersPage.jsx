import React from 'react';
import { useTrip } from '../context/TripContext';
import { Users, Shield, Link as LinkIcon, Check } from 'lucide-react';
import { useState } from 'react';
import { useGuestMode } from '../context/GuestModeContext';

export default function MembersPage() {
    const { members, selectedTrip } = useTrip();
    const isGuest = useGuestMode();
    const [copied, setCopied] = useState(false);

    const handleInvite = () => {
        if (!selectedTrip?.inviteCode) return;
        const shareUrl = `${window.location.origin}/join/${selectedTrip.inviteCode}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Determine deterministic vivid colours for members
    const memberColors = [
        'linear-gradient(135deg, #2F4FA8, #1E3A8A)',
        'linear-gradient(135deg, #D45BA0, #f43f5e)',
        'linear-gradient(135deg, #10b981, #14b8a6)',
        'linear-gradient(135deg, #f59e0b, #f97316)',
        'linear-gradient(135deg, #3b82f6, #06b6d4)',
        'linear-gradient(135deg, #ef4444, #f43f5e)',
    ];
    
    const getMemberColor = (idx) => {
        return memberColors[idx % memberColors.length];
    };

    const getMemberInitial = (name, uid) => {
        if (name) return name.charAt(0).toUpperCase();
        return uid?.charAt(0).toUpperCase() || 'U';
    };

    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <span className="eyebrow" style={{ color: 'var(--color-indigo)' }}>Travel Crew</span>
                    <h1 className="page-title" style={{ marginTop: 6, marginBottom: 6 }}>Members</h1>
                    <p className="page-subtitle">
                        {members.length} {members.length === 1 ? 'person is' : 'people are'} on this trip.
                    </p>
                </div>
                {!isGuest && selectedTrip?.inviteCode && (
                    <button
                        type="button"
                        onClick={handleInvite}
                        className="btn btn-accent btn-md"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        {copied ? <Check size={16} /> : <LinkIcon size={16} />}
                        {copied ? 'Link Copied!' : 'Copy Invite Link'}
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {members.map((m, idx) => (
                    <div key={m.uid} className="glass-card fade-in" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                            style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: getMemberColor(idx),
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 22, fontWeight: 700, flexShrink: 0,
                                boxShadow: '0 4px 12px rgba(15,23,42,0.1)'
                            }}
                            aria-hidden="true"
                        >
                            {getMemberInitial(m.name, m.uid)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.name || 'Traveler'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                {m.role === 'owner' ? (
                                    <>
                                        <Shield size={14} color="var(--color-indigo)" />
                                        <span style={{ color: 'var(--color-indigo)' }}>Trip Owner</span>
                                    </>
                                ) : (
                                    <>
                                        <Users size={14} />
                                        <span>Member</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {members.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-title">No members yet</div>
                    <div className="empty-state-text">Invite friends to start planning together.</div>
                </div>
            )}
        </div>
    );
}
