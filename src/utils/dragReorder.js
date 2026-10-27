// Pointer drag-to-reorder for a list of DOM items (mouse and touch alike).
// Items in the same list share a `data-drag-scope`; each carries its position
// as `data-drag-index`.
//
// Like a phone's list reorder: the item lifts and follows the finger, and
// the other items slide out of the way to open a gap where it will land.
// Letting go glides it into that gap before the list re-renders in its new
// order. The page scrolls near its edges; Esc or a cancelled touch puts
// everything back.
//
// The sliding is done with transforms only (no layout changes), so it stays
// smooth however long the list is.

const SLIDE = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
const SETTLE_MS = 160;

export function startDragReorder(e, { itemEl, scroller, onDrop, onStart, onEnd }) {
    if (!itemEl || (e.button != null && e.button > 0)) return;
    const scope = itemEl.dataset.dragScope;
    const fromIndex = Number(itemEl.dataset.dragIndex);
    if (!scope || !Number.isFinite(fromIndex)) return;
    e.preventDefault();

    // Scroll whichever actually scrolls: the planner column, or the page.
    const scrollsItself = scroller && scroller.scrollHeight > scroller.clientHeight + 1;
    const scrollPos = () => (scrollsItself ? scroller.scrollTop : 0) + window.scrollY;
    const startScroll = scrollPos();

    // Where everything sits before anything moves.
    const rect = itemEl.getBoundingClientRect();
    const others = [...document.querySelectorAll(`[data-drag-scope="${CSS.escape(scope)}"]`)]
        .filter(el => el !== itemEl)
        .map(el => ({ el, index: Number(el.dataset.dragIndex), rect: el.getBoundingClientRect() }))
        .sort((a, b) => a.index - b.index);
    // The space the lifted item leaves: its height plus the gap to its neighbour.
    const next = others.find(o => o.index > fromIndex);
    const prev = [...others].reverse().find(o => o.index < fromIndex);
    const gap = next ? next.rect.top - rect.bottom : prev ? rect.top - prev.rect.bottom : 12;
    const shift = rect.height + Math.max(0, gap);

    const grabOffset = e.clientY - rect.top;
    const ghost = itemEl.cloneNode(true);
    ghost.removeAttribute('data-drag-scope');
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, {
        position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
        margin: 0, zIndex: 3000, pointerEvents: 'none', transition: 'transform 120ms ease, box-shadow 120ms ease',
        boxShadow: '0 24px 48px rgba(15,23,42,0.22)', opacity: '0.97', borderRadius: '16px',
    });
    document.body.append(ghost);
    setTimeout(() => { ghost.style.transform = 'scale(1.02)'; }, 0);
    document.body.classList.add('is-dragging-stop');
    // The item keeps its slot (others slide over it); only the ghost shows.
    itemEl.style.visibility = 'hidden';
    others.forEach(o => { o.el.style.transition = SLIDE; o.el.style.willChange = 'transform'; });
    onStart?.();

    let toIndex = fromIndex;
    let lastY = e.clientY;
    let scrollSpeed = 0;

    // Position k among the others where the item would go, from the
    // pointer's height against each one's resting middle.
    const locate = (y) => {
        const scrolled = scrollPos() - startScroll;
        let k = 0;
        for (const o of others) {
            if (y > o.rect.top - scrolled + o.rect.height / 2) k++;
        }
        if (k === toIndex) return;
        toIndex = k;
        others.forEach((o, i) => {
            // i is this item's position once the lifted one is taken out.
            const moveUp = o.index > fromIndex && i < toIndex;
            const moveDown = o.index < fromIndex && i >= toIndex;
            o.el.style.transform = moveUp ? `translateY(${-shift}px)` : moveDown ? `translateY(${shift}px)` : '';
        });
    };

    const move = (ev) => {
        lastY = ev.clientY;
        ghost.style.top = `${ev.clientY - grabOffset}px`;
        locate(ev.clientY);
        const box = scrollsItself ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        const edge = 90;
        scrollSpeed = ev.clientY < box.top + edge ? -Math.ceil((box.top + edge - ev.clientY) / 6)
            : ev.clientY > box.bottom - edge ? Math.ceil((ev.clientY - (box.bottom - edge)) / 6) : 0;
    };
    const tick = setInterval(() => {
        if (!scrollSpeed) return;
        if (scrollsItself) scroller.scrollTop += scrollSpeed;
        else window.scrollBy(0, scrollSpeed);
        locate(lastY);
    }, 16);

    // Where the lifted item's slot is now: its resting place moved past the
    // items it jumped over, less however far the page has scrolled.
    const landingTop = () => {
        let top = rect.top;
        others.forEach((o, i) => {
            if (o.index > fromIndex && i < toIndex) top += o.rect.height + Math.max(0, gap);
            if (o.index < fromIndex && i >= toIndex) top -= o.rect.height + Math.max(0, gap);
        });
        return top - (scrollPos() - startScroll);
    };

    let done = false;
    const finish = (commit) => {
        if (done) return;
        done = true;
        clearInterval(tick);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        const moved = commit && toIndex !== fromIndex;
        if (!moved) {
            toIndex = fromIndex;
            others.forEach(o => { o.el.style.transform = ''; });
        }

        // Glide the ghost into its slot, then hand the new order to the app.
        ghost.style.transition = `top ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1), transform ${SETTLE_MS}ms ease, box-shadow ${SETTLE_MS}ms ease`;
        ghost.style.top = `${landingTop()}px`;
        ghost.style.transform = '';
        ghost.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)';

        setTimeout(() => {
            if (moved) onDrop(fromIndex, toIndex);
            // Wait for the re-render in the new order before dropping the
            // slide offsets, so nothing jumps back for a frame. (A timer,
            // not animation frames: those pause in a background tab, which
            // would leave the item hidden.)
            setTimeout(() => {
                others.forEach(o => { o.el.style.transition = 'none'; o.el.style.transform = ''; o.el.style.willChange = ''; });
                itemEl.style.visibility = '';
                ghost.remove();
                document.body.classList.remove('is-dragging-stop');
                setTimeout(() => others.forEach(o => { o.el.style.transition = ''; }), 30);
                onEnd?.();
            }, 40);
        }, SETTLE_MS);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => { if (ev.key === 'Escape') finish(false); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
}
