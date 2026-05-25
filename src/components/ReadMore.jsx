import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ReadMore — Production-grade text expander
 *
 * Modes:
 *  - `lines` (number): uses -webkit-line-clamp (best for single text blocks)
 *  - `maxHeight` (number/string): uses max-height clipping (best for mixed content)
 *
 * Features:
 *  - Smooth expand/collapse with CSS transitions
 *  - Bottom fade gradient when collapsed
 *  - ResizeObserver auto-detects overflow changes
 *  - Mobile-first touch targets
 */
function useOverflowCheck(contentRef, deps) {
    const [isClamped, setIsClamped] = useState(false);

    const check = useCallback(() => {
        const el = contentRef.current;
        if (!el) return;
        setIsClamped(el.scrollHeight > el.clientHeight + 2);
    }, [contentRef]);

    useEffect(() => {
        check();
        const ro = new ResizeObserver(check);
        if (contentRef.current) ro.observe(contentRef.current);
        window.addEventListener('resize', check);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', check);
        };
        // `deps` is a caller-supplied array spread into the dependency list —
        // a generic-hook pattern the static rule cannot verify. `check` is
        // memoised and `contentRef` is a stable ref.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [check, ...deps]);

    return isClamped;
}

export default function ReadMore({
    children,
    lines = 3,
    maxHeight,
    className = '',
    btnClassName = '',
    fadeHeight = 40,
    expandText = 'Read more',
    collapseText = 'Show less',
    showToggle = true,
}) {
    const [expanded, setExpanded] = useState(false);
    const contentRef = useRef(null);
    const isClamped = useOverflowCheck(contentRef, [children, lines, maxHeight, expanded]);

    const clampStyle = maxHeight
        ? { maxHeight: expanded ? 'none' : maxHeight }
        : { WebkitLineClamp: expanded ? 'unset' : lines };

    return (
        <div className={`read-more-root ${className}`}>
            <div
                ref={contentRef}
                className={`read-more-content ${maxHeight ? 'read-more-height' : ''} ${expanded ? 'expanded' : ''}`}
                style={clampStyle}
            >
                {children}
            </div>

            {!expanded && isClamped && (
                <div className="read-more-fade" style={{ height: fadeHeight }} />
            )}

            {showToggle && isClamped && (
                <button
                    className={`read-more-btn ${btnClassName}`}
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                    type="button"
                >
                    <span>{expanded ? collapseText : expandText}</span>
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 250ms ease',
                        }}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            )}
        </div>
    );
}

/**
 * ReadMoreHTML — Same as ReadMore but accepts a raw HTML string
 * (for dangerouslySetInnerHTML content like blog markdown paragraphs)
 */
export function ReadMoreHTML({
    html,
    lines = 3,
    maxHeight,
    className = '',
    btnClassName = '',
    fadeHeight = 40,
    expandText = 'Read more',
    collapseText = 'Show less',
}) {
    const [expanded, setExpanded] = useState(false);
    const contentRef = useRef(null);
    const isClamped = useOverflowCheck(contentRef, [html, lines, maxHeight, expanded]);

    const clampStyle = maxHeight
        ? { maxHeight: expanded ? 'none' : maxHeight }
        : { WebkitLineClamp: expanded ? 'unset' : lines };

    return (
        <div className={`read-more-root ${className}`}>
            <div
                ref={contentRef}
                className={`read-more-content ${maxHeight ? 'read-more-height' : ''} ${expanded ? 'expanded' : ''}`}
                style={clampStyle}
                dangerouslySetInnerHTML={{ __html: html }}
            />

            {!expanded && isClamped && (
                <div className="read-more-fade" style={{ height: fadeHeight }} />
            )}

            {isClamped && (
                <button
                    className={`read-more-btn ${btnClassName}`}
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                    type="button"
                >
                    <span>{expanded ? collapseText : expandText}</span>
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 250ms ease',
                        }}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            )}
        </div>
    );
}
