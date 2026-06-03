// src/pages/JoinTripPage.jsx — Redirect to the real trip workspace
// Unauthenticated visitors land here via the invite link, we look up the
// trip and immediately bounce them into the full workspace with a ?invite=
// query param that triggers the guest join banner inside TripLayout.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { publicGetTripByInviteCode } from '../services/publicFirestoreService';
import BrandMark from '../components/BrandMark';
import usePageSeo from '../hooks/usePageSeo';

export default function JoinTripPage() {
    usePageSeo({ title: 'Join Trip', robots: 'noindex, nofollow' });
    const { inviteCode } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        async function redirect() {
            try {
                const trip = await publicGetTripByInviteCode(inviteCode);
                if (!trip) {
                    setError('This invite link is invalid or has expired.');
                    return;
                }
                // Send them to the real trip workspace (Plan tab by default)
                // with invite code in query param so the join banner can appear
                navigate(`/trip/${trip.id}?invite=${inviteCode}`, { replace: true });
            } catch (e) {
                console.error(e);
                setError('Something went wrong. Please try again.');
            }
        }
        redirect();
    }, [inviteCode, navigate]);

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ textAlign: 'center', padding: 32 }}>
                    <div style={{ fontSize: 52, marginBottom: 16 }}>🔗</div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>Link Not Found</h2>
                    <p style={{ color: 'var(--text-tertiary)', margin: '0 0 24px' }}>{error}</p>
                    <Link to="/" className="btn btn-md btn-accent">Go to Trips</Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-primary)' }}>
            <div className="navbar-brand-icon" style={{ width: 52, height: 52, borderRadius: 16 }}>
                <BrandMark size={28} />
            </div>
            <div className="spinner spinner-lg" />
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Opening trip…</span>
        </div>
    );
}
