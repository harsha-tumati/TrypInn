// PM2 entry-point wrapper for Bun.
//
// PM2's Bun fork container (ProcessContainerForkBun.js) loads the entry script
// via require(), which cannot handle ES modules that use top-level await.
// This CJS shim is safe to require() and bridges to the real ESM server.js
// using dynamic import().

import('./server.js').catch((err) => {
  console.error('[pm2-wrapper] Failed to start server:', err);
  process.exit(1);
});
