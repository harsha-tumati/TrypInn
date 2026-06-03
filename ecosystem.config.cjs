// PM2 ecosystem config for Trypinn (production).
//
// The app is a Bun server (server.js) that serves the built SPA from ./dist
// (or from embedded assets when compiled). Build first, then start PM2:
//
//   bun install --production=false
//   bun run build
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup        # persist across reboots
//
// Useful commands:
//   pm2 logs trypinn               # tail logs
//   pm2 reload trypinn             # zero-downtime reload
//   pm2 monit                      # live dashboard
//
// CommonJS (.cjs) is used on purpose: package.json sets "type":"module", and
// PM2 evaluates ecosystem files as CommonJS.

module.exports = {
  apps: [
    {
      name: 'TrypInn',

      // PM2's Bun fork container always uses require() to load the entry point,
      // which fails on ESM files with top-level await (server.js).
      // server-pm2.cjs is a tiny CJS shim that PM2 can safely require(); it
      // bridges to the real server via dynamic import('./server.js').
      script: './server-pm2.cjs',
      interpreter: 'bun',

      // Bun.serve() binds a single port; PM2 cluster mode is not used. To scale
      // horizontally, run multiple instances on different ports behind a
      // reverse proxy (nginx/Caddy), or enable SO_REUSEPORT in server.js.
      exec_mode: 'fork',
      instances: 1,

      cwd: __dirname,

      // Production defaults. Override PORT/HOST per host as needed.
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },

      // Resilience
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '15s',
      restart_delay: 2000,
      kill_timeout: 5000,          // give in-flight requests time to drain
      max_memory_restart: '512M',

      // Logs (rotate with `pm2 install pm2-logrotate`)
      time: true,
      merge_logs: true,
      output: './logs/trypinn-out.log',
      error: './logs/trypinn-error.log',
    },
  ],
};
