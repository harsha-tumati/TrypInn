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