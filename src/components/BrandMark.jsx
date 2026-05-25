import React, { useId } from 'react';

/**
 * TripSync brand mark — a location pin with a warm sunset (gold → coral)
 * gradient and a clean negative-space core, so the tile colour shows
 * through the hole. Sits on a coloured tile (.navbar-brand-icon,
 * .login-logo, .join-logo) but also reads well on any background.
 */
export default function BrandMark({ size = 24, className = '', style }) {
    // useId() contains colons — strip them so the gradient id is safe to
    // reference via url(#id) in the SVG fill.
    const id = 'bm' + useId().replace(/[^a-zA-Z0-9]/g, '');
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            className={className}
            style={style}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={id} x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#FBBF3B" />
                    <stop offset="1" stopColor="#FF6B4A" />
                </linearGradient>
            </defs>
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M16 2.4 C9.7 2.4 4.6 7.4 4.6 13.6 C4.6 21.6 13.4 27.3 16 29.6 C18.6 27.3 27.4 21.6 27.4 13.6 C27.4 7.4 22.3 2.4 16 2.4 Z M11.3 13.5 A4.7 4.7 0 1 0 20.7 13.5 A4.7 4.7 0 1 0 11.3 13.5 Z"
                fill={`url(#${id})`}
            />
        </svg>
    );
}
