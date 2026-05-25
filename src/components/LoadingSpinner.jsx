// src/components/LoadingSpinner.jsx
import React from 'react';

export default function LoadingSpinner({ size = 'md', text = '', fullPage = false }) {
    const cls = size === 'sm' ? 'spinner spinner-sm' : size === 'lg' ? 'spinner spinner-lg' : 'spinner';
    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: fullPage ? 80 : 40,
                minHeight: fullPage ? '60vh' : 'auto',
            }}
        >
            <div className={cls} aria-hidden="true"></div>
            {text && <span style={{ color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 500 }}>{text}</span>}
            {!text && <span style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>Loading…</span>}
        </div>
    );
}
