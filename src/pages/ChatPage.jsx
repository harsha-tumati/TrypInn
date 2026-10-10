// src/pages/ChatPage.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTrip } from '../context/TripContext';
import useMentions, { mentionsAi } from '../hooks/useMentions';
import MentionMenu from '../components/MentionMenu';
import { useAuth } from '../context/AuthContext';
import { useGuestMode } from '../context/GuestModeContext';
import { sendMessage } from '../services/firestoreService';
import { chatWithAssistant } from '../config/openai';
import { formatTimestamp } from '../utils/dateHelpers';
import { Send, Sparkles, Users } from 'lucide-react';
import usePageSeo from '../hooks/usePageSeo';

// Split a message body so mentions can be styled. Tokens come from the
// message's own `mentions` array where present; older messages predate that
// field, so `@ai` is always recognised as a fallback.
function renderMessageText(text, mentions) {
    const tokens = new Set(['@ai']);
    for (const m of mentions || []) {
        if (m.kind === 'ai') tokens.add('@ai');
        else if (m.label) tokens.add(`@${m.label.split(' ')[0]}`);
    }
    const escaped = [...tokens]
        .sort((a, b) => b.length - a.length)          // longest first, so @ai never eats @aisha
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (escaped.length === 0) return text;

    const re = new RegExp(`(${escaped.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
    // split() with one capture group interleaves the matches, so every odd
    // index is a mention. Testing each part against the regex instead would be
    // wrong — a /g/ regex carries lastIndex between calls.
    const parts = text.split(re);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
        i % 2 === 1
            ? <mark key={i} className="chat-mention">{part}</mark>
            : part
    );
}

// Unsent messages, per trip, for the session — switching tabs mid-sentence
// used to throw the draft away.
const drafts = new Map();

export default function ChatPage() {
    usePageSeo({ title: 'Trip Chat', robots: 'noindex, nofollow' });
    const { messages, selectedTrip, places, members } = useTrip();
    const { user, userProfile } = useAuth();
    const isGuest = useGuestMode();
    const draftKey = selectedTrip?.id || '';
    const [text, setText] = useState(() => drafts.get(draftKey) || '');
    useEffect(() => {
        if (!draftKey) return;
        if (text) drafts.set(draftKey, text); else drafts.delete(draftKey);
    }, [draftKey, text]);
    const [aiTyping, setAiTyping] = useState(false);
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, aiTyping]);

    // Determine deterministic vivid colours for members
    const memberColors = [
        'linear-gradient(135deg, #2F4FA8, #1E3A8A)',
        'linear-gradient(135deg, #D45BA0, #f43f5e)',
        'linear-gradient(135deg, #10b981, #14b8a6)',
        'linear-gradient(135deg, #f59e0b, #f97316)',
        'linear-gradient(135deg, #3b82f6, #06b6d4)',
        'linear-gradient(135deg, #ef4444, #f43f5e)',
    ];
    const getMemberColor = (uid) => {
        const idx = members.findIndex(m => m.uid === uid);
        return memberColors[idx >= 0 ? idx % memberColors.length : 0];
    };

    const getMemberInitial = (name, uid) => {
        if (name) return name.charAt(0).toUpperCase();
        return uid?.charAt(0).toUpperCase() || 'U';
    };

    // What "@" offers. The assistant is pinned first because it is the one
    // mention that does something rather than just notifying a person, and
    // `@ai` stays the literal token so the existing trigger below still fires.
    const mentionOptions = useMemo(() => {
        const ai = {
            id: 'ai_assistant',
            token: '@ai',
            label: 'Trypinn AI',
            sublabel: 'Ask for travel advice',
            kind: 'ai',
        };
        const people = members
            .filter(m => m.uid !== user?.uid)
            .map(m => ({
                id: m.uid,
                token: `@${(m.name || 'member').split(' ')[0]}`,
                label: m.name || 'Member',
                sublabel: m.role === 'admin' ? 'Trip admin' : null,
                kind: 'member',
                initial: getMemberInitial(m.name, m.uid),
                color: getMemberColor(m.uid),
            }));
        return [ai, ...people];
    }, [members, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

    const mentions = useMentions({ value: text, onChange: setText, textareaRef, options: mentionOptions });

    async function handleSend() {
        if (!user) { alert('Please sign in to send messages.'); return; }
        if (!text.trim()) return;
        const content = text.trim();
        const mentioned = mentions.mentionsIn(content);
        setText('');
        mentions.reset();

        await sendMessage({
            tripId: selectedTrip.id,
            uid: user?.uid,
            senderName: userProfile?.name || user?.displayName || 'Traveler',
            senderPhoto: userProfile?.photoURL || user?.photoURL || null,
            text: content,
            mentions: mentioned,
        });

        if (mentionsAi(content)) {
            setAiTyping(true);
            try {
                const tripContext = {
                    destination: selectedTrip?.destination || '',
                    startDate: selectedTrip?.startDate || '',
                    endDate: selectedTrip?.endDate || '',
                    selectedPlaces: places.filter((p) => p.selected).map((p) => p.name),
                };

                const recentMsgs = messages.slice(-5).map(m => ({
                    role: m.uid === 'ai_assistant' ? 'assistant' : 'user',
                    content: m.uid === 'ai_assistant' ? m.text : `${m.senderName}: ${m.text}`
                }));

                const reply = await chatWithAssistant({ messages: [...recentMsgs, { role: 'user', content }], tripContext });

                await sendMessage({
                    tripId: selectedTrip.id,
                    uid: 'ai_assistant',
                    senderName: 'Trypinn AI',
                    text: reply,
                });
            } catch (e) {
                console.error("AI Chat Error:", e);
                await sendMessage({
                    tripId: selectedTrip.id,
                    uid: 'ai_assistant',
                    senderName: 'Trypinn AI',
                    text: "Sorry, I'm having trouble thinking right now.",
                });
            } finally {
                setAiTyping(false);
            }
        }
    }

    function handleKeyDown(e) {
        // The menu gets first refusal: while it is open, Enter picks a name
        // rather than sending a half-typed message.
        if (mentions.handleKeyDown(e)) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    const avatarSize = 'clamp(32px, 4vw, 40px)';
    const headerAvatarSize = 'clamp(26px, 3.4vw, 32px)';

    return (
        <div className="chat-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>
            {/* Header */}
            <div
                className="chat-header"
                style={{
                    padding: 'clamp(14px, 2.2vw, 22px) clamp(18px, 3vw, 36px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 14,
                    flexShrink: 0,
                }}
            >
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, rgba(91,92,246,0.14), rgba(139,92,246,0.14))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-indigo)', border: '1px solid rgba(91,92,246,0.2)' }} aria-hidden="true">
                            <Users size={18} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                            <h2 style={{ fontSize: 'clamp(16px, 2.2vw, 19px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.4px' }}>Trip Chat</h2>
                            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: 0, fontWeight: 500 }}>
                                Type <code style={{ background: 'rgba(91,92,246,0.1)', color: 'var(--color-indigo)', padding: '1px 6px', borderRadius: 6, fontFamily: 'inherit', fontWeight: 700 }}>@</code> to mention someone · <code style={{ background: 'rgba(91,92,246,0.1)', color: 'var(--color-indigo)', padding: '1px 6px', borderRadius: 6, fontFamily: 'inherit', fontWeight: 700 }}>@ai</code> for travel advice
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', overflow: 'hidden', flexShrink: 0, maxWidth: '50%', justifyContent: 'flex-end' }} aria-label={`${members.length} members in chat`}>
                    {members.slice(0, 5).map((m, idx) => (
                        <div
                            key={m.uid}
                            style={{
                                width: headerAvatarSize, height: headerAvatarSize, borderRadius: '50%',
                                background: getMemberColor(m.uid),
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 'clamp(10px, 1.4vw, 13px)', fontWeight: 700, border: '2.5px solid #fff',
                                marginLeft: idx > 0 ? -8 : 0, zIndex: 10 - idx,
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(15,23,42,0.12)',
                            }}
                            title={m.name || 'Member'}
                        >
                            {getMemberInitial(m.name, m.uid)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Messages */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 'clamp(16px, 2.4vw, 32px) clamp(16px, 3vw, 36px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 22,
                    background: 'transparent',
                }}
            >
                {messages.length === 0 && (
                    <div className="empty-state" style={{ padding: 'clamp(48px, 8vw, 80px) 24px', margin: 'auto' }}>
                        <div className="empty-state-icon" style={{ fontSize: 56 }}>💬</div>
                        <div className="empty-state-title">No messages yet</div>
                        <div className="empty-state-text">Say hi to your travel crew — or type <code style={{ background: 'rgba(91,92,246,0.1)', color: 'var(--color-indigo)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>@ai</code> to get suggestions.</div>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const isAI = msg.uid === 'ai_assistant';
                    const isMe = msg.uid === user?.uid;
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showHeader = !prevMsg || prevMsg.uid !== msg.uid || (msg.timestamp - prevMsg.timestamp > 600000);
                    const senderMember = members.find(m => m.uid === msg.uid);
                    const displaySenderName = isMe ? 'You' : (senderMember?.name || msg.senderName || 'Traveler');

                    return (
                        <div
                            key={msg.id || idx}
                            style={{
                                display: 'flex',
                                gap: 'clamp(8px, 1.5vw, 14px)',
                                flexDirection: isMe ? 'row-reverse' : 'row',
                            }}
                        >
                            {showHeader ? (
                                isAI ? (
                                    <div style={{
                                        width: avatarSize, height: avatarSize, borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--color-indigo), var(--color-violet))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        boxShadow: '0 4px 12px rgba(91,92,246,0.28)',
                                    }} aria-hidden="true">
                                        <Sparkles size={18} color="#fff" />
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            width: avatarSize, height: avatarSize, borderRadius: '50%',
                                            background: getMemberColor(msg.uid),
                                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 'clamp(13px, 1.7vw, 16px)', fontWeight: 700, flexShrink: 0,
                                            boxShadow: '0 4px 10px rgba(15,23,42,0.1)',
                                        }}
                                        aria-hidden="true"
                                    >
                                        {getMemberInitial(displaySenderName === 'You' ? (userProfile?.name || user?.displayName) : displaySenderName, msg.uid)}
                                    </div>
                                )
                            ) : (
                                <div style={{ width: avatarSize, flexShrink: 0 }} aria-hidden="true"></div>
                            )}

                            <div style={{ flex: 1, maxWidth: '78%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                {showHeader && (
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'clamp(13px, 1.7vw, 14.5px)', letterSpacing: '-0.2px' }}>
                                            {displaySenderName}
                                        </span>
                                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>{msg.timestamp ? formatTimestamp(msg.timestamp) : 'Just now'}</span>
                                    </div>
                                )}
                                <div
                                    className={`chat-bubble ${isAI ? 'chat-bubble-ai' : isMe ? 'chat-bubble-user' : 'chat-bubble-other'}`}
                                    style={{ maxWidth: '100%', wordBreak: 'break-word' }}
                                >
                                    {renderMessageText(msg.text, msg.mentions)}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {aiTyping && (
                    <div style={{ display: 'flex', gap: 'clamp(8px, 1.5vw, 14px)' }}>
                        <div style={{
                            width: avatarSize, height: avatarSize, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-indigo), var(--color-violet))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            boxShadow: '0 4px 12px rgba(91,92,246,0.28)', animation: 'pulse 1.6s ease-in-out infinite',
                        }} aria-hidden="true">
                            <Sparkles size={18} color="#fff" />
                        </div>
                        <div style={{ flex: 1, maxWidth: '78%', minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'clamp(13px, 1.7vw, 14.5px)', marginBottom: 6 }}>Trypinn AI</div>
                            <div className="chat-bubble chat-bubble-ai" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-indigo)', animation: 'pulse 1s infinite', display: 'inline-block' }}></span>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-indigo)', animation: 'pulse 1s infinite 0.2s', display: 'inline-block' }}></span>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-indigo)', animation: 'pulse 1s infinite 0.4s', display: 'inline-block' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef}></div>
            </div>

            {/* Input Bar */}
            {isGuest ? (
                <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>🔒 Join this trip to chat with members</div>
                </div>
            ) : (
                <div
                    className="chat-input-bar"
                    style={{
                        padding: 'clamp(12px, 2vw, 20px) clamp(14px, 3vw, 36px)',
                        paddingBottom: 'calc(clamp(12px, 2vw, 20px) + env(safe-area-inset-bottom, 0px))',
                        flexShrink: 0,
                    }}
                >
                    <div style={{
                        background: '#fff',
                        border: '1.5px solid var(--border-medium)',
                        borderRadius: 16,
                        padding: 'clamp(10px, 1.5vw, 14px) clamp(14px, 2vw, 18px)',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                        position: 'relative',
                    }}>
                        {mentions.open && (
                            <MentionMenu
                                items={mentions.items}
                                activeIndex={mentions.activeIndex}
                                onPick={mentions.choose}
                                onHover={mentions.setActiveIndex}
                            />
                        )}
                        <label htmlFor="chat-textarea" className="sr-only" style={{ position: 'absolute', left: -9999 }}>Message</label>
                        <textarea
                            id="chat-textarea"
                            ref={textareaRef}
                            placeholder="Write a message…  type @ to mention someone or the AI"
                            value={text}
                            onChange={mentions.handleChange}
                            onKeyDown={handleKeyDown}
                            onSelect={mentions.handleSelect}
                            onBlur={mentions.close}
                            aria-autocomplete="list"
                            aria-expanded={mentions.open}
                            rows={1}
                            style={{ border: 'none', background: 'transparent', width: '100%', resize: 'none', fontSize: 15, color: 'var(--text-primary)', outline: 'none', marginBottom: 12, minHeight: 26, fontFamily: 'inherit', lineHeight: 1.5 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                                <kbd style={{ background: 'rgba(15,23,42,0.06)', padding: '2px 6px', borderRadius: 5, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Enter</kbd> to send · <kbd style={{ background: 'rgba(15,23,42,0.06)', padding: '2px 6px', borderRadius: 5, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Shift+Enter</kbd> new line
                            </div>
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={!text.trim()}
                                aria-label="Send message"
                                style={{
                                    background: text.trim() ? 'linear-gradient(135deg, var(--color-indigo), var(--color-violet))' : 'rgba(15, 23, 42, 0.08)',
                                    color: text.trim() ? '#fff' : 'var(--text-muted)',
                                    border: 'none', width: 44, height: 44,
                                    borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: text.trim() ? 'pointer' : 'not-allowed',
                                    transition: 'all var(--transition-fast)',
                                    flexShrink: 0,
                                    boxShadow: text.trim() ? '0 6px 16px rgba(91,92,246,0.32)' : 'none',
                                }}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
