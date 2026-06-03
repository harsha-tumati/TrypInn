import './index.css';

// ── Deferred ("lazy") hydration ──────────────────────────────────────────────
// The homepage ("/") is fully prerendered into #root at build time and styled
// by inline critical CSS, so it is complete and readable with zero JavaScript.
// We therefore DON'T download/parse React until the user actually interacts —
// this keeps the main thread free during load (fast FCP/LCP, ~0 TBT). On the
// first real gesture we dynamically import React + the app and hydrate the
// existing markup in place (no node swap).
//
// IMPORTANT: detect a real prerender by counting ELEMENT children. In dev (and
// any build where the prerender step didn't run) #root holds only the
// "<!--app-html-->" placeholder comment — `firstChild` would be truthy but
// `children.length` is 0 — so we must NOT try to hydrate it; we client-render
// immediately instead. This is what prevents a blank page in dev.
const rootEl = document.getElementById('root');
const isHome = window.location.pathname === '/';
const hasPrerender = !!rootEl && rootEl.children.length > 0;

let booted = false;
function boot() {
  if (booted) return;
  booted = true;

  // Activate the deferred (other-routes) stylesheet so client navigation is styled.
  for (const link of document.querySelectorAll('link[data-rest-css]')) link.media = 'all';

  return Promise.all([
    import('react'),
    import('react-dom/client'),
    import('./App.jsx'),
  ]).then(([React, ReactDOM, { default: App }]) => {
    const tree = React.createElement(React.StrictMode, null, React.createElement(App));
    if (isHome && hasPrerender) {
      ReactDOM.hydrateRoot(rootEl, tree);
    } else {
      rootEl.replaceChildren();
      ReactDOM.createRoot(rootEl).render(tree);
    }
  });
}

if (isHome && hasPrerender) {
  // Production homepage: prerendered markup is already on screen, so wait for the
  // first user intent before booting React. These gestures all precede a
  // meaningful action (a tap's pointerdown/touchstart fires before its click).
  const TRIGGERS = ['pointerdown', 'touchstart', 'keydown', 'mousedown', 'click', 'scroll'];
  const onFirst = () => {
    for (const ev of TRIGGERS) window.removeEventListener(ev, onFirst, { capture: true });
    boot();
  };
  for (const ev of TRIGGERS) {
    window.addEventListener(ev, onFirst, { capture: true, once: true, passive: true });
  }
} else {
  // Dev, or any non-prerendered route: render immediately (no blank screen).
  boot();
}

// Register the service worker (production only — avoids dev HMR interference).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silently ignore — service worker registration can fail in incognito
      // or privacy modes, which is expected and not user-facing.
    });
  });
}
