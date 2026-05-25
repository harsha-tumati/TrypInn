// Render smoke test — proves the app mounts real content into #root
// (i.e. no blank screen) even with NO environment configuration.
// Run: bun test scripts/render-smoke.test.jsx
import { test, expect, beforeAll } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
    GlobalRegistrator.register({ url: 'http://localhost/' });
});

test('app renders non-empty content into #root without env config', async () => {
    // Mimic Vite's import.meta.env with everything unset.
    globalThis.import_meta_env = {};

    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const App = (await import('../src/App.jsx')).default;

    const reactRoot = createRoot(root);
    reactRoot.render(React.createElement(App));

    // Allow effects/microtasks to flush.
    await new Promise((r) => setTimeout(r, 200));

    const html = root.innerHTML;
    expect(html.length).toBeGreaterThan(200);          // not blank
    expect(html).toContain('TripSync');                // brand rendered
    expect(/Where to next/i.test(html)).toBe(true);    // home dashboard rendered

    reactRoot.unmount();
});
