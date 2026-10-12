// src/pages/PollsPage.jsx
import React, { useEffect, useState } from 'react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useGuestMode } from '../context/GuestModeContext';
import { castVote, closePoll, deletePlace } from '../services/firestoreService';
import { BarChart3, Crown, Sparkles, Vote, X, CheckCircle2, AlertCircle } from 'lucide-react';
import usePageSeo from '../hooks/usePageSeo';

export default function PollsPage() {
    usePageSeo({ title: 'Trip Polls', robots: 'noindex, nofollow' });
    const { polls, places, selectedTrip } = useTrip();
    const { user } = useAuth();
    const isGuest = useGuestMode();
    const [closing, setClosing] = useState(null);
    // Results and errors show as a banner on the page, not a browser alert.
    const [notice, setNotice] = useState(null); // { tone: 'success' | 'error', text }
    const say = (text, tone = 'success') => setNotice({ text, tone });
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 6000);
        return () => clearTimeout(t);
    }, [notice]);

    async function handleVote(pollId, placeId) {
        if (!user) { say('Sign in to vote.', 'error'); return; }
        try { await castVote({ pollId, placeId, userId: user?.uid }); }
        catch (e) { say(`Couldn't save your vote — ${e.message}`, 'error'); }
    }

    async function handleClose(pollId) {
        setClosing(pollId);
        try {
            const poll = polls.find((p) => p.id === pollId);
            const winnerId = await closePoll(pollId, selectedTrip.id);
            if (poll?.kind === 'include') {
                say(winnerId === 'no'
                    ? `Poll closed — the crew would skip ${poll.subjectName}. You can remove it below.`
                    : winnerId === 'yes' ? `Poll closed — ${poll.subjectName} stays in the plan.` : 'Poll closed — no one voted.');
            } else {
                const winningPlace = places.find((p) => p.id === winnerId);
                say(winningPlace ? `Poll closed — ${winningPlace.name} won and is on your route.` : 'Poll closed — no one voted.');
            }
        } catch (e) { say(`Couldn't close the poll — ${e.message}`, 'error'); }
        finally { setClosing(null); }
    }

    function getOptionLabel(opt) {
        return opt.label || places.find((p) => p.id === opt.placeId)?.name || opt.placeId;
    }

    // The stop a yes/no poll is about (by id, else by name — the stop may not
    // have been saved yet when the poll was started).
    const subjectOf = (poll) => places.find((p) => p.id === poll.subjectPlaceId)
        || places.find((p) => p.name?.trim().toLowerCase() === poll.subjectName?.trim().toLowerCase());
    const [removing, setRemoving] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(null); // poll id asking "are you sure?"
    async function removeSubject(poll) {
        const stop = subjectOf(poll);
        if (!stop) return;
        setRemoving(poll.id);
        try {
            await deletePlace(stop.id);
            say(`${stop.name} was removed from the plan.`);
        } catch (e) { say(`Couldn't remove ${stop.name} — ${e.message}`, 'error'); }
        finally { setRemoving(null); setConfirmRemove(null); }
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
                            ? 'Resolve group disagreements democratically. Put a stop to a vote from the Plan tab, or compare places on the Map.'
                            : `${openPolls} live · ${closedPolls} closed · cast your vote and see the winner instantly.`}
                    </p>
                </div>
            </div>

            {notice && (
                <div className={`poll-notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
                    {notice.tone === 'error' ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                    <span>{notice.text}</span>
                    <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button>
                </div>
            )}

            {polls.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🗳️</div>
                    <div className="empty-state-title">No polls yet</div>
                    <div className="empty-state-text">On the Plan tab, tap 🗳 on any stop to ask the crew whether to keep it — or pick two or more places on the Map to vote between them.</div>
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
                                                    <span style={{ fontWeight: 700, fontSize: 'clamp(13px, 1.8vw, 15px)', color: 'var(--text-primary)' }}>{getOptionLabel(opt)}</span>
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
                                {!isOpen && poll.kind !== 'include' && (
                                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.22)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                                        <Vote size={16} aria-hidden="true" /> Winner added to your trip stops.
                                    </div>
                                )}
                                {!isOpen && poll.kind === 'include' && (
                                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Vote size={16} aria-hidden="true" />
                                            {poll.winnerId === 'no'
                                                ? `The crew would skip ${poll.subjectName}.`
                                                : poll.winnerId === 'yes' ? `${poll.subjectName} stays in the plan.` : 'No votes were cast.'}
                                        </span>
                                        {poll.winnerId === 'no' && !isGuest && subjectOf(poll) && (
                                            confirmRemove === poll.id ? (
                                                <span style={{ display: 'flex', gap: 8 }}>
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeSubject(poll)} disabled={removing === poll.id}>
                                                        {removing === poll.id ? 'Removing…' : `Yes, remove ${poll.subjectName}`}
                                                    </button>
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(null)}>Keep it</button>
                                                </span>
                                            ) : (
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(poll.id)}>
                                                    Remove {poll.subjectName} from the plan
                                                </button>
                                            )
                                        )}
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
