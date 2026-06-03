import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import purgeCSS from 'vite-plugin-purgecss'
import { compression } from 'vite-plugin-compression2'

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
      ]
    }),
    compression({ algorithm: 'brotliCompress' }),
    injectModulePreload()
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('react-dom')) return 'vendor-react'
            if (id.includes('react')) return 'vendor-react'
            if (id.includes('scheduler')) return 'vendor-react'
            if (id.includes('firebase')) return 'vendor-firebase'
            if (id.includes('openai')) return 'vendor-openai'
            if (id.includes('@vis.gl')) return 'vendor-maps'
            if (id.includes('date-fns')) return 'vendor-date-fns'
            return 'vendor'
          }
        },
      },
    },
  },
})