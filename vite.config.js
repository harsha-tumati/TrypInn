import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import purgeCSS from 'vite-plugin-purgecss'
import { compression } from 'vite-plugin-compression2'

function openaiProxyDevPlugin() {
  return {
    name: 'openai-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/openai/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk.toString(); });
        req.on('end', async () => {
          try {
            const env = loadEnv('', process.cwd(), '');
            const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;

            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'OpenAI API key not configured' }));
              return;
            }

            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: bodyStr
            });

            const data = await openaiRes.text();
            res.statusCode = openaiRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } catch (err) {
             res.statusCode = 500;
             res.setHeader('Content-Type', 'application/json');
             res.end(JSON.stringify({ error: 'Failed to proxy request' }));
          }
        });
      });
    }
  };
}

/**
 * Inject <link rel="modulepreload"> for the main entry chunks into the
 * built HTML so the browser can start fetching them before the module
 * graph is parsed.
 */
function injectModulePreload() {
  return {
    name: 'inject-module-preload',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html
      const preloads = []
      for (const [name, chunk] of Object.entries(ctx.bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          preloads.push(`<link rel="modulepreload" href="/${chunk.fileName}" />`)
          // Also preload direct imports of entry chunks
          for (const imp of chunk.imports || []) {
            if (imp.includes('vendor')) {
              preloads.push(`<link rel="modulepreload" href="/${imp}" />`)
            }
          }
        }
      }
      if (preloads.length) {
        const marker = '<!-- Critical resource hints — Vite build will inject modulepreload links here -->'
        return html.replace(marker, preloads.join('\n    '))
      }
      return html
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    purgeCSS({
      safelist: [
        // State classes added dynamically by JS
        'active', 'selected', 'open', 'modal-overlay', 'modal-content',
        'is-in', 'is-past', 'is-claimed', 'is-guest',
        // Animation classes toggled by IntersectionObserver or state
        'fade-in', 'fade-in-up', 'slide-in',
        // Class names built at runtime (`theme-${id}`, `hp-tilt-${i % 3}`):
        // PurgeCSS only keeps names it finds written out in the source, so
        // without these the trip-cover palettes and the destination-card tilt
        // were stripped from production CSS.
        /^theme-/, /^hp-tilt-/,
      ]
    }),
    compression({ algorithm: 'brotliCompress' }),
    injectModulePreload(),
    openaiProxyDevPlugin()
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    // Keep media queries as `max-width` — the minifier otherwise rewrites them
    // to range syntax (`width<=1023px`), which Safari only reads from iOS 16.4.
    cssTarget: ['safari14', 'chrome90', 'firefox90', 'edge90'],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Match specific libs BEFORE the generic react-core check below —
          // react-datepicker, @vis.gl/react-google-maps and lucide-react all
          // contain "react" in their path and would otherwise be swept into
          // vendor-react (eagerly loaded on the homepage). Keeping them in their
          // own chunks lets them stay lazy (datepicker/maps only load inside the
          // modal/when Maps is enabled).
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('react-datepicker')) return 'vendor-datepicker'
          if (id.includes('@vis.gl') || id.includes('react-google-maps')) return 'vendor-maps'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('openai')) return 'vendor-openai'
          // React core (react, react-dom, scheduler) — the only big vendor we
          // want on the initial homepage path.
          if (/[\\/]react-dom[\\/]/.test(id) || /[\\/]react[\\/]/.test(id) || /[\\/]scheduler[\\/]/.test(id) || id.includes('react/jsx-runtime')) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
})