import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'embedded-assets.js', 'trypinn', 'trypinn-*']),
  // Server-side & build scripts (Bun runtime) — node + Bun globals
  {
    files: ['server.js', 'scripts/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, Bun: 'readonly' },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  // Bun test files — node + browser (happy-dom) + bun:test globals
  {
    files: ['scripts/**/*.test.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, Bun: 'readonly' },
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Client-side (browser) — React + Vite
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // React 19 + Vite/SWC don't need React in scope for JSX
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^(_|React$)',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // `preserve-manual-memoization` only matters when the React Compiler is
      // enabled (it warns the compiler can't preserve a useMemo). This project
      // does not run the compiler, so the rule is inapplicable, not suppressed.
      'react-hooks/preserve-manual-memoization': 'off',
      // TripsPage / BlogPage intentionally export shared constants alongside
      // their component (TRENDING). This only affects HMR granularity, not
      // correctness — keep it off rather than splitting files needlessly.
      'react-refresh/only-export-components': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // exhaustive-deps and set-state-in-effect stay ON (recommended level) —
      // they catch real stale-closure and cascading-render bugs.
    },
  },
])
