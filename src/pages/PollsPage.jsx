// src/pages/PollsPage.jsx
import React, { useState } from 'react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useGuestMode } from '../context/GuestModeContext';
import { castVote, closePoll } from '../services/firestoreService';
import { BarChart3, Crown, Sparkles, Vote } from 'lucide-react';

export default function PollsPage() {
    const { polls, places, selectedTrip } = useTrip();
    const { user } = useAuth();
    const isGuest = useGuestMode();
    const [closing, setClosing] = useState(null);

    async function handleVote(pollId, placeId) {
        if (!user) { alert('Please sign in to vote.'); return; }
        try { await castVote({ pollId, placeId, userId: user?.uid }); }
        catch (e) { alert(e.message); }
    }

    async function handleClose(pollId) {
        setClosing(pollId);
        try {
            const winnerId = await closePoll(pollId, selectedTrip.id);
            const winningPlace = places.find((p) => p.id === winnerId);
            alert(`Poll closed — Winner: ${winningPlace?.name || 'Unknown'}`);
        } catch (e) { alert(e.message); }
        finally { setClosing(null); }
    }

    function getPlaceName(placeId) {
        return places.find((p) => p.id === placeId)?.name || placeId;
    }

    const openPolls = polls.filter(p => p.status === 'open').length;
    const closedPolls = polls.length - openPolls;

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <span className="eyebrow" style={{ color: 'var(--color-violet)' }}>Decide as a group</span>
                    <h1 className="page-title" style={{ marginTop: 6 }}>Polls</h1>
                    <p className="page-subtitle">
                        {polls.length === 0
                            ? 'Resolve group disagreements democratically. Create polls from the Map view.'
                            : `${openPolls} live · ${closedPolls} closed · cast your vote and see the winner instantly.`}
                    </p>
                </div>
            </div>

            {polls.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🗳️</div>
                    <div className="empty-state-title">No polls yet</div>
                    <div className="empty-state-text">Head to the Map tab, select two or more places, and create a poll so the whole crew can vote.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    {polls.map((poll) => {
                        const isOpen = poll.status === 'open';
                        const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0);
                        const myVote = poll.options.find((o) => o.votes.includes(user?.uid))?.placeId;

                        return (
                            <div key={poll.id} className="poll-card fade-in">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                        <span style={{
                                            width: 36, height: 36, borderRadius: 12,
                                            background: isOpen ? 'linear-gradient(135deg, rgba(91,92,246,0.16), rgba(139,92,246,0.16))' : 'rgba(15,23,42,0.06)',
                                            color: isOpen ? 'var(--color-indigo)' : 'var(--text-tertiary)',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            border: isOpen ? '1px solid rgba(91,92,246,0.22)' : '1px solid var(--border-subtle)',
                                            flexShrink: 0,
                                        }} aria-hidden="true">
                                            <BarChart3 size={18} />
                                        </span>
                                        <h3 style={{ fontSize: 'clamp(16px, 2vw, 19px)', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.4px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{poll.title}</h3>
                                    </div>
                                    <span className={`badge ${isOpen ? 'badge-emerald' : 'badge-slate'}`}>
                                        {isOpen ? (
                                            <>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 8px currentColor' }} aria-hidden="true"></span>
                                                Live · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                                            </>
                                        ) : (
                                            'Closed'
                                        )}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {poll.options.map((opt) => {
                                        const votes = opt.votes.length;
                                        const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                        const isWinner = poll.winnerId === opt.placeId;
                                        const isMine = myVote === opt.placeId;

                                        return (
                                            <button
                                                key={opt.placeId}
                                                type="button"
                                                onClick={() => isOpen && !isGuest && handleVote(poll.id, opt.placeId)}
                                                disabled={!isOpen || isGuest}
                                                className={`poll-option${isMine ? ' voted' : ''}`}
                                                style={{
                                                    cursor: (isOpen && !isGuest) ? 'pointer' : 'default',
                                                    borderColor: isWinner ? 'var(--color-amber)' : undefined,
                                                    background: isWinner ? 'rgba(245,158,11,0.08)' : undefined,
                                                }}
                                                aria-pressed={isMine}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                                    <span style={{ fontWeight: 700, fontSize: 'clamp(13px, 1.8vw, 15px)', color: 'var(--text-primary)' }}>{getPlaceName(opt.placeId)}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {isMine && <span className="badge badge-indigo" style={{ padding: '2px 8px', fontSize: 10 }}>Your vote</span>}
                                                        {isWinner && <Crown size={16} color="var(--color-amber)" aria-hidden="true" />}
                                                        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                                            {votes} vote{votes !== 1 ? 's' : ''} · {Math.round(pct)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="poll-progress-bg">
                                                    <div
                                                        className="poll-progress-fill"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: isWinner ? 'linear-gradient(90deg, var(--color-amber), var(--color-gold))' : undefined,
                                                        }}
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {isOpen && poll.createdBy === user?.uid && (
                                    <button
                                        type="button"
                                        className="btn btn-accent btn-md"
                                        style={{ width: '100%', marginTop: 18 }}
                                        onClick={() => handleClose(poll.id)}
                                        disabled={!!closing}
                                    >
                                        {closing === poll.id
                                            ? <div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}></div>
                                            : <><Sparkles size={16} aria-hidden="true" /> Close poll & lock in winner</>}
                                    </button>
                                )}
                                {!isOpen && (
                                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.22)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                                        <Vote size={16} aria-hidden="true" /> Winner added to your trip stops.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
