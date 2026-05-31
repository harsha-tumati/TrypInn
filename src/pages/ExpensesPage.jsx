// src/pages/ExpensesPage.jsx
import React, { useState } from 'react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useGuestMode } from '../context/GuestModeContext';
import { addExpense, calcBalances } from '../services/firestoreService';
import Modal from '../components/Modal';
import { Plus, IndianRupee, Users, TrendingUp, ArrowRight, Receipt, CheckCircle2 } from 'lucide-react';

const CATEGORY_META = {
    Accommodation: { color: '#2F4FA8', emoji: '🏨' },
    Transport:     { color: '#06b6d4', emoji: '🚗' },
    Food:          { color: '#f59e0b', emoji: '🍜' },
    Activities:    { color: '#ef4444', emoji: '🎟️' },
    General:       { color: '#64748b', emoji: '💼' },
};

const MEMBER_GRADIENTS = [
    'linear-gradient(135deg, #2F4FA8, #1E3A8A)',
    'linear-gradient(135deg, #D45BA0, #f43f5e)',
    'linear-gradient(135deg, #10b981, #14b8a6)',
    'linear-gradient(135deg, #f59e0b, #f97316)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #ef4444, #f43f5e)',
];

export default function ExpensesPage() {
    const { expenses, selectedTrip, members } = useTrip();
    const { user } = useAuth();
    const isGuest = useGuestMode();
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ title: '', amount: '', category: 'General' });
    const [copiedIdx, setCopiedIdx] = useState(null);

    const totalSpend = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const numMembers = members.length || 1;
    const perPerson = totalSpend / numMembers;

    const categoryTotals = expenses.reduce((acc, e) => {
        const cat = e.category || 'General';
        acc[cat] = (acc[cat] || 0) + (e.amount || 0);
        return acc;
    }, {});
    const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCategoryEntry ? topCategoryEntry[0] : 'None';
    const topCategoryAmount = topCategoryEntry ? topCategoryEntry[1] : 0;

    async function handleSettleCopy(owes, idx) {
        const from = owes.from === user?.uid ? 'You' : (members.find(m => m.uid === owes.from)?.name || 'Friend');
        const to = owes.to === user?.uid ? 'You' : (members.find(m => m.uid === owes.to)?.name || 'Friend');
        const text = `${from} → ${to}: ₹${owes.amount.toFixed(2)} (Trypinn · ${selectedTrip?.name || 'trip'})`;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(c => (c === idx ? null : c)), 1800);
        } catch (e) {
            console.error('Copy failed', e);
            alert(text);
        }
    }

    async function handleAdd() {
        if (!user) { alert('Please sign in to add an expense.'); return; }
        if (!form.title.trim() || !form.amount) {
            alert('Add a title and amount to log this expense.');
            return;
        }
        const splitAmong = members.length > 0 ? members.map((m) => m.uid) : [user?.uid];
        await addExpense({
            tripId: selectedTrip.id,
            title: form.title.trim(),
            amount: parseFloat(form.amount),
            paidBy: user?.uid,
            splitAmong,
            category: form.category,
            date: new Date().toISOString()
        });
        setAddOpen(false);
        setForm({ title: '', amount: '', category: 'General' });
    }

    const balances = calcBalances(expenses, members.length > 0 ? members : [{ uid: user?.uid }]);

    function memberIndex(uid) {
        const idx = members.findIndex(m => m.uid === uid);
        return idx >= 0 ? idx : 0;
    }

    function getMemberDetails(uid) {
        if (uid === user?.uid) return { name: 'You', initial: 'Y', gradient: MEMBER_GRADIENTS[0] };
        const m = members.find((m) => m.uid === uid);
        return {
            name: m?.name || (uid?.slice(0, 6) ?? '—'),
            initial: (m?.name || uid || 'M').charAt(0).toUpperCase(),
            gradient: MEMBER_GRADIENTS[memberIndex(uid) % MEMBER_GRADIENTS.length],
        };
    }

    const owesList = [];
    let positiveBals = [];
    let negativeBals = [];

    Object.entries(balances).forEach(([uid, bal]) => {
        if (bal > 0.01) positiveBals.push({ uid, amount: bal });
        else if (bal < -0.01) negativeBals.push({ uid, amount: Math.abs(bal) });
    });

    let i = 0, j = 0;
    while (i < negativeBals.length && j < positiveBals.length) {
        const debtor = negativeBals[i];
        const creditor = positiveBals[j];
        const amount = Math.min(debtor.amount, creditor.amount);

        owesList.push({ from: debtor.uid, to: creditor.uid, amount });

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return (
        <div className="expenses-page">
            {/* Header */}
            <div style={{ marginBottom: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <span className="eyebrow" style={{ color: 'var(--color-coral)' }}>Money matters</span>
                    <h1 className="page-title" style={{ marginTop: 6, marginBottom: 6 }}>Trip Expenses</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 'clamp(14px, 1.8vw, 16px)', fontWeight: 500 }}>Log shared costs, settle up fairly, and never argue about a tab again.</p>
                </div>
                {!isGuest && (
                    <button
                        type="button"
                        onClick={() => setAddOpen(true)}
                        className="btn btn-accent btn-md"
                    >
                        <Plus size={16} aria-hidden="true" /> Add Expense
                    </button>
                )}
            </div>

            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20, marginBottom: 48 }}>
                {/* Total Cost Card */}
                <div className="expense-stat-card" style={{
                    background: 'linear-gradient(135deg, #172E6E 0%, #1E3A8A 55%, #2F4FA8 100%)',
                    color: '#fff', border: 'none', boxShadow: '0 14px 36px rgba(91,92,246,0.36)', position: 'relative', overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 60%)', pointerEvents: 'none' }} aria-hidden="true" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, position: 'relative' }}>
                        <div style={{ background: 'rgba(255,255,255,0.18)', padding: 10, borderRadius: 12, display: 'inline-flex', border: '1px solid rgba(255,255,255,0.18)' }} aria-hidden="true">
                            <IndianRupee size={20} color="#fff" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: 0.4, textTransform: 'uppercase' }}>Total Spend</span>
                    </div>
                    <div style={{ fontSize: 'clamp(30px, 4.4vw, 44px)', fontWeight: 900, marginBottom: 4, letterSpacing: -1.4, position: 'relative' }}>₹{totalSpend.toFixed(2)}</div>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', position: 'relative' }}>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} logged</div>
                </div>

                <div className="expense-stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                        <div style={{ background: 'rgba(91,92,246,0.1)', padding: 10, borderRadius: 12, border: '1px solid rgba(91,92,246,0.18)' }} aria-hidden="true">
                            <Users size={20} color="var(--color-indigo)" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.4, textTransform: 'uppercase' }}>Per Person</span>
                    </div>
                    <div style={{ fontSize: 'clamp(30px, 4.4vw, 44px)', fontWeight: 900, marginBottom: 4, color: 'var(--text-primary)', letterSpacing: -1.4 }}>₹{perPerson.toFixed(2)}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Split equally among {numMembers}</div>
                </div>

                <div className="expense-stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                        <div style={{ background: 'rgba(255,111,97,0.12)', padding: 10, borderRadius: 12, border: '1px solid rgba(255,111,97,0.18)' }} aria-hidden="true">
                            <TrendingUp size={20} color="var(--color-coral)" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.4, textTransform: 'uppercase' }}>Top Category</span>
                    </div>
                    <div style={{ fontSize: 'clamp(30px, 4.4vw, 44px)', fontWeight: 900, marginBottom: 4, color: 'var(--text-primary)', letterSpacing: -1.4 }}>₹{topCategoryAmount.toFixed(2)}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                        {(CATEGORY_META[topCategory]?.emoji ?? '')} {topCategory}
                    </div>
                </div>
            </div>

            <div className="expenses-layout">
                {/* Left: All Expenses */}
                <div className="expenses-left">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 'clamp(17px, 2.2vw, 20px)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
                            All Expenses {expenses.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 14 }}>· {expenses.length}</span>}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {expenses.length === 0 ? (
                            <div className="glass-card-static" style={{ padding: 48, textAlign: 'center' }}>
                                <div style={{ fontSize: 48, marginBottom: 14 }} aria-hidden="true">💸</div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.3px' }}>No expenses yet</h3>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 18 }}>Add your first cost — anything from a hotel deposit to a coffee run.</p>
                                {!isGuest && (
                                    <button type="button" onClick={() => setAddOpen(true)} className="btn btn-accent btn-md">
                                        <Plus size={16} aria-hidden="true" /> Log First Expense
                                    </button>
                                )}
                            </div>
                        ) : (
                            expenses.map((item) => {
                                const splitAmount = item.amount / (item.splitAmong?.length || 1);
                                const payer = getMemberDetails(item.paidBy);
                                const date = item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
                                const catMeta = CATEGORY_META[item.category] || CATEGORY_META.General;

                                return (
                                    <div key={item.id} className="glass-card" style={{ padding: 'clamp(16px, 2vw, 22px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', minHeight: 88 }}>
                                        <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', gap: 14 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${catMeta.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: `1px solid ${catMeta.color}33` }} aria-hidden="true">
                                                {catMeta.emoji}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 'clamp(15px, 2vw, 16.5px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.2px' }}>{item.title}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: catMeta.color, background: `${catMeta.color}14`, border: `1px solid ${catMeta.color}26`, textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.category || 'General'}</span>
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{date}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-tertiary)' }}>
                                                    <span>Paid by</span>
                                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: payer.gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }} aria-hidden="true">
                                                        {payer.initial}
                                                    </div>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{payer.name}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: 'clamp(20px, 2.6vw, 24px)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: -0.6 }}>₹{item.amount?.toFixed(2)}</div>
                                            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>₹{splitAmount.toFixed(2)} each</div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }} aria-label={`Split among ${item.splitAmong?.length ?? 1} people`}>
                                                {(item.splitAmong || []).slice(0, 4).map((uid, idx) => {
                                                    const m = getMemberDetails(uid);
                                                    return (
                                                        <div key={idx} style={{ width: 26, height: 26, borderRadius: '50%', background: m.gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '2.5px solid #fff', marginLeft: idx > 0 ? -8 : 0, boxShadow: '0 2px 6px rgba(15,23,42,0.1)' }} title={m.name}>
                                                            {m.initial}
                                                        </div>
                                                    );
                                                })}
                                                {(item.splitAmong?.length ?? 0) > 4 && (
                                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2.5px solid #fff', marginLeft: -8, boxShadow: '0 2px 6px rgba(15,23,42,0.1)' }}>
                                                        +{(item.splitAmong.length - 4)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right: Who Owes Who */}
                <div className="expenses-right">
                    <h2 style={{ fontSize: 'clamp(17px, 2.2vw, 20px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18, letterSpacing: '-0.4px' }}>Settle Up</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {owesList.length === 0 ? (
                            <div className="glass-card-static" style={{ padding: 28, textAlign: 'center' }}>
                                <CheckCircle2 size={36} color="var(--color-emerald)" style={{ margin: '0 auto 10px' }} aria-hidden="true" />
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>All settled up!</h3>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 13.5 }}>Nobody owes anyone — clean slate.</p>
                            </div>
                        ) : (
                            owesList.map((owes, idx) => {
                                const from = getMemberDetails(owes.from);
                                const to = getMemberDetails(owes.to);

                                return (
                                    <div key={idx} className="glass-card" style={{ padding: 'clamp(16px, 2vw, 20px)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 8, flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ width: 38, height: 38, borderRadius: '50%', background: from.gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, boxShadow: '0 3px 10px rgba(15,23,42,0.12)' }} aria-hidden="true">
                                                    {from.initial}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{from.name}</div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>owes</div>
                                                </div>
                                            </div>

                                            <ArrowRight size={18} color="var(--color-indigo)" style={{ flexShrink: 0 }} aria-hidden="true" />

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{to.name}</div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>receives</div>
                                                </div>
                                                <div style={{ width: 38, height: 38, borderRadius: '50%', background: to.gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, boxShadow: '0 3px 10px rgba(15,23,42,0.12)' }} aria-hidden="true">
                                                    {to.initial}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.18)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Receipt size={16} color="var(--color-emerald)" aria-hidden="true" />
                                                <div style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 900, color: 'var(--color-emerald)', letterSpacing: -0.4 }}>₹{owes.amount.toFixed(2)}</div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-md"
                                                style={{ background: copiedIdx === idx ? 'var(--color-emerald)' : 'rgba(16,185,129,0.16)', color: copiedIdx === idx ? '#fff' : '#065f46', boxShadow: copiedIdx === idx ? '0 4px 12px rgba(16,185,129,0.28)' : 'none', border: '1px solid rgba(16,185,129,0.32)' }}
                                                onClick={() => handleSettleCopy(owes, idx)}
                                                aria-label={`Copy settlement details for ${getMemberDetails(owes.from).name} to ${getMemberDetails(owes.to).name}`}
                                            >
                                                <CheckCircle2 size={15} aria-hidden="true" /> {copiedIdx === idx ? 'Copied' : 'Copy details'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Add Expense Modal */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Expense" subtitle="Track a shared cost — we'll split it fairly across your group.">
                <div style={{ padding: '4px 0' }}>
                    <label className="input-label" htmlFor="expense-title">Description</label>
                    <input
                        id="expense-title"
                        className="input-field"
                        placeholder="e.g. Airbnb deposit, group dinner…"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        style={{ marginBottom: 18 }}
                        autoFocus
                    />

                    <div className="form-row" style={{ marginBottom: 18 }}>
                        <div>
                            <label className="input-label" htmlFor="expense-amount">Amount (₹)</label>
                            <input
                                id="expense-amount"
                                className="input-field"
                                type="number"
                                placeholder="0.00"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                style={{ fontWeight: 600 }}
                                inputMode="decimal"
                            />
                        </div>
                        <div>
                            <label className="input-label" htmlFor="expense-category">Category</label>
                            <select
                                id="expense-category"
                                value={form.category}
                                onChange={(e) => setForm({...form, category: e.target.value})}
                                className="input-field"
                                style={{ paddingRight: 36, cursor: 'pointer' }}
                            >
                                {Object.keys(CATEGORY_META).map(k => (
                                    <option key={k} value={k}>{CATEGORY_META[k].emoji}  {k}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24, padding: '12px 14px', background: 'rgba(91,92,246,0.06)', border: '1px solid rgba(91,92,246,0.16)', borderRadius: 12 }}>
                        Splits equally among <strong style={{ color: 'var(--text-primary)' }}>{numMembers} member{numMembers !== 1 ? 's' : ''}</strong>.
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost btn-md" onClick={() => setAddOpen(false)}>Cancel</button>
                        <button type="button" className="btn btn-accent btn-md" onClick={handleAdd}>
                            Save Expense
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
