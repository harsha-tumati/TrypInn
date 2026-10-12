import React from 'react';
import { useTrip } from '../context/TripContext';
import { Users, Shield } from 'lucide-react';
import { useIsTripOrganiser } from '../components/ShareTripDialog';
import JoinRequestsList from '../components/JoinRequestsList';
import usePageSeo from '../hooks/usePageSeo';

export default function MembersPage() {
    usePageSeo({ title: 'Trip Members', robots: 'noindex, nofollow' });
    const { members, joinRequests } = useTrip();
    const isOrganiser = useIsTripOrganiser();

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
                {/* Inviting lives in the top bar's Invite button, on every trip screen. */}
            </div>

            {isOrganiser && joinRequests.length > 0 && (
                <section className="glass-card-static" style={{ padding: 20, marginBottom: 24 }} aria-label="Requests to join">
                    <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary)' }}>
                        {joinRequests.length} {joinRequests.length === 1 ? 'person wants' : 'people want'} to join
                    </h2>
                    <JoinRequestsList />
                </section>
            )}

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
                                {m.role === 'owner' || m.role === 'admin' ? (
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
