#!/usr/bin/env bun
// Prerender the homepage ("/") to static HTML and inject it into #root, so the
// LCP element (hero <h1>) paints from HTML before any JS runs. main.jsx then
// HYDRATES this markup (rather than replacing it), so the painted node is
// reused — no second LCP candidate, no layout shift.
//
// renderToString does NOT run useEffect, so the output matches the client's
// initial (pre-effect) render exactly — which is what makes hydration clean.
// happy-dom supplies window/document/history so <BrowserRouter> resolves to "/".
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register({ url: 'http://localhost/', width: 1280, height: 800 });

import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, writeFileSync } from 'node:fs';

// Import App only after the DOM globals exist.
const { default: App } = await import('../src/App.jsx');

const appHtml = renderToString(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);

const htmlPath = 'dist/index.html';
let doc = readFileSync(htmlPath, 'utf8');
if (!doc.includes('<!--app-html-->')) {
  throw new Error('prerender: <!--app-html--> placeholder missing in dist/index.html');
}
doc = doc.replace('<!--app-html-->', appHtml);
writeFileSync(htmlPath, doc);

console.log(`Prerender: injected ${(appHtml.length / 1024).toFixed(1)} kB homepage HTML into #root.`);
