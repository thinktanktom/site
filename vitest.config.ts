import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

/**
 * The palette engine is plain TypeScript with no JSX and no DOM dependency, so
 * this stays near-empty on purpose.
 *
 * `environment: 'node'` is the default and is stated explicitly because it is a
 * decision: apply.ts is tested against a hand-rolled fake element and a fake
 * Storage (see lib/palette/__tests__/fixtures.ts) rather than jsdom/happy-dom,
 * which would add a large dependency to exercise three methods.
 */
export default defineConfig({
  /* The palette engine imports nothing, but lib/work.ts does -- and it uses the
     `@lib/*` alias from tsconfig.json, which Vite does not read. Without this,
     importing it from a test fails to resolve. Mirror any new tsconfig path
     here. */
  resolve: {
    alias: {
      '@lib': fileURLToPath(new URL('./lib', import.meta.url)),
      '@components': fileURLToPath(new URL('./components', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
})
