// Scroll to a section of a page that may still be growing above it (images,
// lazily loaded lists). A single smooth scroll aims at where the section is
// *now*; when content above it then loads, the section moves and the scroll
// ends somewhere random. This keeps re-aiming while the page settles, and
// leaves the page alone the moment the person scrolls or taps themselves.

const SETTLE_MS = 2500;

export function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return false;

    // Land just below the floating navbar, not under it.
    const offset = () => (document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0) + 12;
    const targetY = () => Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset());

    window.scrollTo({ top: targetY(), behavior: 'smooth' });

    let done = false;
    const stop = () => {
        if (done) return;
        done = true;
        ro.disconnect();
        clearTimeout(timer);
        for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.removeEventListener(ev, stop);
    };
    // Re-aim (instantly) whenever the page's height changes while settling.
    const ro = new ResizeObserver(() => {
        if (Math.abs(el.getBoundingClientRect().top - offset()) > 4) window.scrollTo({ top: targetY(), behavior: 'instant' }); // 'auto' would follow the page's CSS smooth scrolling
    });
    ro.observe(document.body);
    const timer = setTimeout(stop, SETTLE_MS);
    // Listen from the next frame, so the tap that started this doesn't cancel it.
    requestAnimationFrame(() => {
        if (done) return;
        for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(ev, stop, { passive: true });
    });
    return true;
}
