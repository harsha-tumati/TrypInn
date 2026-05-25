import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, subtitle, children, dismissable = true, size = 'md' }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape' && dismissable) onClose?.(); };
        document.addEventListener('keydown', onKey);
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = original;
        };
    }, [open, onClose, dismissable]);

    if (!open) return null;

    const maxWidths = { sm: 420, md: 540, lg: 680 };

    return (
        <div
            className="modal-overlay"
            onClick={dismissable ? onClose : undefined}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: maxWidths[size] || maxWidths.md }}
            >
                {dismissable && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        style={{
                            position: 'absolute', top: 18, right: 18,
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'rgba(17, 19, 30, 0.05)', border: '1px solid var(--line)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-secondary)', transition: 'background var(--transition-fast), color var(--transition-fast)',
                            zIndex: 2,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(17, 19, 30, 0.11)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(17, 19, 30, 0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <X size={18} />
                    </button>
                )}
                {title && (
                    <h3 id="modal-title" className="modal-title">{title}</h3>
                )}
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                {children}
            </div>
        </div>
    );
}
