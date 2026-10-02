// src/components/MentionMenu.jsx
// The list that drops out of the chat composer when someone types "@".
//
// Positioned above the input rather than below it: the composer already sits
// at the bottom of the viewport, and on a phone the keyboard covers anything
// rendered underneath.
import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';

export default function MentionMenu({ items, activeIndex, onPick, onHover }) {
    const listRef = useRef(null);

    // Keep the keyboard-selected row in view when arrowing past the fold.
    useEffect(() => {
        const el = listRef.current?.querySelector('[data-active="true"]');
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    if (items.length === 0) return null;

    return (
        <div className="mention-menu" role="listbox" aria-label="Mention someone" ref={listRef}>
            {items.map((item, i) => {
                const active = i === activeIndex;
                return (
                    <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        data-active={active}
                        className={`mention-item${active ? ' is-active' : ''}`}
                        // mousedown, not click: the textarea would blur first and
                        // the caret position we insert at would be lost.
                        onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
                        onMouseEnter={() => onHover(i)}
                    >
                        <span
                            className="mention-avatar"
                            style={item.kind === 'ai' ? undefined : { background: item.color }}
                            aria-hidden="true"
                        >
                            {item.kind === 'ai' ? <Sparkles size={15} /> : item.initial}
                        </span>
                        <span className="mention-text">
                            <span className="mention-name">{item.label}</span>
                            {item.sublabel && <span className="mention-sub">{item.sublabel}</span>}
                        </span>
                        <span className="mention-token">{item.token}</span>
                    </button>
                );
            })}
        </div>
    );
}
