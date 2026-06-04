// src/components/InstallPrompt.jsx — PWA install banner
// Intercepts the beforeinstallprompt event and shows a polished A2HS prompt.
// Dismissal is remembered in localStorage so users aren't nagged repeatedly.
import React, { useState, useEffect, useCallback } from 'react';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'trypinn_pwa_install_dismissed';
const DISMISS_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Don't show if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        if (navigator.standalone) return; // iOS Safari

        // Don't show if recently dismissed
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION) return;

        function handleBeforeInstall(e) {
            e.preventDefault();
            setDeferredPrompt(e);
            // Small delay so the page has time to paint first
            setTimeout(() => setVisible(true), 2500);
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }, []);

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setVisible(false);
        }
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        setVisible(false);
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }, []);

    if (!visible) return null;

    return (
        <div className="pwa-install-banner" role="alert">
            <div className="pwa-install-content">
                <div className="pwa-install-icon-wrap">
                    <Download size={20} />
                </div>
                <div className="pwa-install-text">
                    <strong>Add Trypinn to home screen</strong>
                    <span>Quick access, offline-ready, full-screen experience</span>
                </div>
            </div>
            <div className="pwa-install-actions">
                <button
                    type="button"
                    className="pwa-install-btn"
                    onClick={handleInstall}
                >
                    Install
                </button>
                <button
                    type="button"
                    className="pwa-install-dismiss"
                    onClick={handleDismiss}
                    aria-label="Dismiss install prompt"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
