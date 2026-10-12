// Pointer drag-to-reorder for a list of DOM items (mouse and touch alike).
// Items in the same list share a `data-drag-scope`; each carries its position
// as `data-drag-index`. Dragging shows a lifted copy of the item under the
// finger, a line where it will land, and scrolls the page near its edges.
// Esc or a cancelled touch puts everything back.
//
// Styling reuses the itinerary's drag classes (.itin-drop-line,
// body.is-dragging-stop).

export function startDragReorder(e, { itemEl, scroller, onDrop, onStart, onEnd }) {
    if (!itemEl || (e.button != null && e.button > 0)) return;
    const scope = itemEl.dataset.dragScope;
    const fromIndex = Number(itemEl.dataset.dragIndex);
    if (!scope || !Number.isFinite(fromIndex)) return;
    e.preventDefault();

    const rect = itemEl.getBoundingClientRect();
    const grabOffset = e.clientY - rect.top;
    const ghost = itemEl.cloneNode(true);
    ghost.removeAttribute('data-drag-scope');
    Object.assign(ghost.style, {
        position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
        margin: 0, zIndex: 3000, pointerEvents: 'none', transition: 'none',
        transform: 'scale(1.02)', boxShadow: '0 24px 48px rgba(15,23,42,0.22)', opacity: '0.96',
        borderRadius: '16px',
    });
    const line = document.createElement('div');
    line.className = 'itin-drop-line';
    document.body.append(ghost, line);
    document.body.classList.add('is-dragging-stop');
    itemEl.style.opacity = '0.35';
    onStart?.();

    let toIndex = fromIndex;
    let lastY = e.clientY;
    let scrollSpeed = 0;

    const locate = (y) => {
        const others = [...document.querySelectorAll(`[data-drag-scope="${CSS.escape(scope)}"]`)]
            .filter(el => el !== itemEl)
            .map(el => ({ el, rect: el.getBoundingClientRect(), index: Number(el.dataset.dragIndex) }))
            .sort((a, b) => a.index - b.index);
        if (!others.length) return;
        const below = others.find(o => y < o.rect.top + o.rect.height / 2);
        const without = (i) => (i > fromIndex ? i - 1 : i);
        const anchor = below || others[others.length - 1];
        toIndex = below ? without(below.index) : without(anchor.index) + 1;
        const lineY = below ? below.rect.top - 6 : anchor.rect.bottom + 4;
        Object.assign(line.style, { top: `${lineY}px`, left: `${anchor.rect.left}px`, width: `${anchor.rect.width}px` });
        line.classList.toggle('is-noop', toIndex === fromIndex);
    };

    const move = (ev) => {
        lastY = ev.clientY;
        ghost.style.top = `${ev.clientY - grabOffset}px`;
        locate(ev.clientY);
        const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        const edge = 90;
        scrollSpeed = ev.clientY < box.top + edge ? -Math.ceil((box.top + edge - ev.clientY) / 6)
            : ev.clientY > box.bottom - edge ? Math.ceil((ev.clientY - (box.bottom - edge)) / 6) : 0;
    };
    const tick = setInterval(() => {
        if (!scrollSpeed) return;
        if (scroller) scroller.scrollTop += scrollSpeed;
        else window.scrollBy(0, scrollSpeed);
        locate(lastY);
    }, 16);

    const finish = (commit) => {
        clearInterval(tick);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        ghost.remove();
        line.remove();
        itemEl.style.opacity = '';
        document.body.classList.remove('is-dragging-stop');
        onEnd?.();
        if (commit && toIndex !== fromIndex) onDrop(fromIndex, toIndex);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => { if (ev.key === 'Escape') finish(false); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    locate(e.clientY);
}
