// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { firebaseConfigured } from '../config/firebase';
import { Map, Vote, Calendar, MessageCircle, Wallet, AlertTriangle } from 'lucide-react';
import BrandMark from '../components/BrandMark';

export default function LoginPage() {
    const { user, signInWithGoogle } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const location = useLocation();
    const from = location.state?.from || '/trips';

    if (user) return <Navigate to={from} replace />;

    async function handleGoogleSignIn() {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(err.message || 'Sign-in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    const features = [
        { Icon: Map, text: 'AI-curated places, drawn on your shared map' },
        { Icon: Vote, text: 'Group polls so the trip never stalls' },
        { Icon: Calendar, text: 'Smart day-by-day itinerary, auto-built' },
        { Icon: MessageCircle, text: 'Realtime chat with @ai travel assistant' },
        { Icon: Wallet, text: 'Effortless expense splitting with balances' },
    ];

    return (
        <div className="login-page">
            <div className="login-card">
                {/* Brand */}
                <div className="login-brand">
                    <div className="login-logo" aria-hidden="true">
                        <BrandMark size={44} />
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span className="eyebrow">Travel · Together</span>
                    </div>
                    <h1 className="login-app-name">TripSync</h1>
                    <p className="login-tagline">Plan trips together, effortlessly.</p>
                </div>

                {/* Features */}
                <div className="login-features" role="list">
                    {features.map(({ Icon, text }, i) => (
                        <div
                            key={i}
                            role="listitem"
                            className="login-feature-row"
                            style={{ animationDelay: `${0.12 + i * 0.07}s` }}
                        >
                            <span
                                style={{
                                    width: 38, height: 38, borderRadius: 12,
                                    background: 'rgba(30, 58, 138, 0.1)',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--accent)', flexShrink: 0,
                                    border: '1px solid rgba(30, 58, 138, 0.22)',
                                }}
                                aria-hidden="true"
                            >
                                <Icon size={18} strokeWidth={2.2} />
                            </span>
                            <span className="login-feature-text">{text}</span>
                        </div>
                    ))}
                </div>

                {!firebaseConfigured && (
                    <div
                        role="alert"
                        style={{
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                            background: 'rgba(188, 132, 16, 0.09)', border: '1px solid rgba(188, 132, 16, 0.26)',
                            color: 'var(--warning)', padding: '13px 15px', borderRadius: 'var(--radius-sm)',
                            fontSize: 13, lineHeight: 1.5, marginBottom: 16, fontWeight: 500,
                        }}
                    >
                        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                        <span>
                            <strong>Setup needed:</strong> add a <code>.env</code> file with your Firebase keys
                            (see <code>.env.example</code>) to enable sign-in.
                        </span>
                    </div>
                )}

                {error && <div className="login-error" role="alert">{error}</div>}

                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading || !firebaseConfigured}
                    className="login-google-btn"
                    aria-label="Continue with Google"
                >
                    {loading ? (
                        <div className="spinner spinner-sm" style={{ borderTopColor: 'var(--ink-on-dark)', borderColor: 'rgba(245, 244, 241, 0.32)' }} aria-hidden="true" />
                    ) : (
                        <>
                            <span className="login-google-icon" aria-hidden="true">G</span>
                            <span className="login-google-text">Continue with Google</span>
                        </>
                    )}
                </button>

                <p className="login-disclaimer">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
