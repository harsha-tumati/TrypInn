// src/hooks/useMentions.js
// WhatsApp-style "@" autocomplete for a plain <textarea>.
//
// Watches the text immediately before the caret. When it looks like someone is
// part-way through typing a mention, this exposes the matching options and the
// keyboard handling to pick one; the caller renders the list.
//
// A textarea (rather than a contenteditable) keeps the message a plain string,
// which is what Firestore already stores. The uids of whoever was picked are
// tracked alongside it so a message can record who it mentioned without having
// to re-parse names out of the text later.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

// `@` counts as the start of a mention only at the beginning of the message or
// after whitespace, so an email address never opens the menu. The query itself
// is letters/digits/underscore — stopping at a space means picking someone
// whose name has a space in it still closes the menu cleanly.
const MENTION_RE = /(?:^|\s)@([\p{L}\p{N}_]*)$/u;

/**
 * Is the caret inside a mention being typed?
 * @returns {{query: string, start: number}|null} start is the index of the '@'
 */
export function findMentionQuery(text, caret) {
    const m = text.slice(0, caret).match(MENTION_RE);
    if (!m) return null;
    return { query: m[1], start: caret - m[1].length - 1 };
}

/**
 * Replace the half-typed mention with the chosen token, followed by a space so
 * the next word does not re-open the menu. If the text after the caret already
 * begins with a space, reuse it rather than ending up with two.
 */
export function applyMention(text, caret, start, token) {
    const rest = text.slice(caret);
    const insert = rest.startsWith(' ') ? token : `${token} `;
    return {
        text: text.slice(0, start) + insert + rest,
        // Caret lands after the space either way, ready for the next word.
        caret: start + token.length + 1,
    };
}

/**
 * Does this message actually address the assistant?
 *
 * The old check was `text.includes('@ai')`, which also fired on "@Aisha",
 * "@aishwarya" and "me@ai.com". Now that "@" offers real people by name that
 * would misfire constantly, so this applies the same boundary rules the menu
 * uses: preceded by start-of-string or whitespace, and not followed by another
 * word character.
 */
const AI_MENTION_RE = /(?:^|\s)@ai(?![\p{L}\p{N}_])/iu;

export function mentionsAi(text) {
    return AI_MENTION_RE.test(text || '');
}

/** Options whose name or token match what has been typed so far. */
export function filterOptions(options, query) {
    const q = query.toLowerCase();
    if (!q) return options;
    return options.filter(o =>
        o.label.toLowerCase().includes(q) || o.token.slice(1).toLowerCase().startsWith(q)
    );
}

/**
 * @param {object}   args
 * @param {string}   args.value          current textarea value
 * @param {Function} args.onChange       setter for that value
 * @param {object}   args.textareaRef    ref to the <textarea>
 * @param {Array}    args.options        [{ id, token, label, sublabel, kind }]
 */
export default function useMentions({ value, onChange, textareaRef, options }) {
    const [query, setQuery] = useState(null); // null = menu closed
    const [start, setStart] = useState(0);    // index of the '@'
    const [activeIndex, setActiveIndex] = useState(0);
    // Everyone picked so far, so the message can carry uids and not just text.
    const [picked, setPicked] = useState([]);
    // Caret position to restore after a controlled re-render.
    const pendingCaret = useRef(null);

    const items = useMemo(
        () => (query === null ? [] : filterOptions(options, query)),
        [query, options],
    );

    const open = query !== null && items.length > 0;

    const close = useCallback(() => {
        setQuery(null);
        setActiveIndex(0);
    }, []);

    /** Re-evaluate the menu from wherever the caret currently is. */
    const sync = useCallback((text, caret) => {
        const found = findMentionQuery(text, caret);
        if (!found) {
            setQuery(null);
            return;
        }
        setQuery(found.query);
        setStart(found.start);
        setActiveIndex(0);
    }, []);

    const handleChange = useCallback((e) => {
        onChange(e.target.value);
        sync(e.target.value, e.target.selectionStart ?? e.target.value.length);
    }, [onChange, sync]);

    /** Moving the caret with arrows or a click can leave or enter a mention. */
    const handleSelect = useCallback((e) => {
        sync(e.target.value, e.target.selectionStart ?? 0);
    }, [sync]);

    const choose = useCallback((option) => {
        if (!option) return;
        const caret = textareaRef.current?.selectionStart ?? value.length;
        const next = applyMention(value, caret, start, option.token);
        pendingCaret.current = next.caret;
        onChange(next.text);
        setPicked(prev => (prev.some(p => p.id === option.id) ? prev : [...prev, option]));
        close();
    }, [value, start, onChange, close, textareaRef]);

    useLayoutEffect(() => {
        if (pendingCaret.current == null) return;
        const el = textareaRef.current;
        const pos = pendingCaret.current;
        pendingCaret.current = null;
        if (!el) return;
        el.focus();
        el.setSelectionRange(pos, pos);
    }, [value, textareaRef]);

    /**
     * Keyboard handling for the menu.
     * @returns {boolean} true when the menu consumed the event, so the caller
     *   knows not to also send the message on Enter.
     */
    const handleKeyDown = useCallback((e) => {
        if (!open) return false;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(i => (i + 1) % items.length);
                return true;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(i => (i - 1 + items.length) % items.length);
                return true;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                choose(items[activeIndex]);
                return true;
            case 'Escape':
                e.preventDefault();
                close();
                return true;
            default:
                return false;
        }
    }, [open, items, activeIndex, choose, close]);

    /** Whoever is still actually referenced in the text, for the sent message. */
    const mentionsIn = useCallback((text) => {
        const lower = text.toLowerCase();
        return picked
            .filter(p => lower.includes(p.token.toLowerCase()))
            .map(p => ({ id: p.id, label: p.label, kind: p.kind }));
    }, [picked]);

    const reset = useCallback(() => {
        setPicked([]);
        close();
    }, [close]);

    return { open, items, activeIndex, setActiveIndex, choose, handleChange, handleKeyDown, handleSelect, close, mentionsIn, reset };
}
