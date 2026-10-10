import React, { useId } from 'react';

// "Folded map" pin: three map panels clipped to a pin with a hollow core.
const PIN_PATH =
    'M24 44 C21.2 40 12 31.2 12 18 A12 12 0 0 1 36 18 C36 31.2 26.8 40 24 44 Z M19.4 18 A4.6 4.6 0 1 0 28.6 18 A4.6 4.6 0 1 0 19.4 18 Z';

const TONES = {
    // On the indigo / ink tiles (.navbar-brand-icon, .login-logo, .join-logo)
    light: ['#FFFFFF', '#FF6B4A', '#C7D2FE'],
    // On white or pale backgrounds
    color: ['#2F4FA8', '#FF6B4A', '#1E3A8A'],
};

/**
 * Trypinn brand mark — a pin made of three folded map panels
 * (left panel, coral fold, right panel). `tone="light"` for dark tiles,
 * `tone="color"` for light backgrounds.
 */
export default function BrandMark({ size = 24, tone = 'light', className = '', style }) {
    // useId() contains colons — strip them so the clip id is safe in url(#id).
    const id = 'bm' + useId().replace(/[^a-zA-Z0-9]/g, '');
    const [left, fold, right] = TONES[tone] || TONES.light;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            className={className}
            style={style}
            aria-hidden="true"
        >
            <defs>
                <clipPath id={id}>
                    <path clipRule="evenodd" d={PIN_PATH} />
                </clipPath>
            </defs>
            <g clipPath={`url(#${id})`}>
                <polygon points="0,0 21,0 17,48 0,48" fill={left} />
                <polygon points="21,0 29,0 26,48 17,48" fill={fold} />
                <polygon points="29,0 48,0 48,48 26,48" fill={right} />
            </g>
        </svg>
    );
}
