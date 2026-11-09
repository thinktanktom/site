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
    },
  },
  test: {
    environment: 'node',
    /* `components/**` joined `lib/**` when the lockup mask split landed. That
       test touches no React and no DOM -- it reads four SVG files off disk and
       asserts they still reassemble into one another -- so it belongs under
       `environment: 'node'` with everything else. Keep component tests to that
       shape; anything needing a rendered tree would need a DOM environment and
       is a bigger decision than adding a glob. */
    /* `scripts/**` joined the globs on 2026-11-09, with the first test for
       scripts/sync-timelog.mjs. An audit found the producer half of /activity
       had no coverage at all -- including bucketFor, the single function
       standing between a client-named timewarrior tag and a committed, crawled
       file -- while its consumer had 21 tests. Note the `.mjs` extension in
       that glob: the scripts are plain ESM JavaScript, not TypeScript. */
    include: [
      'lib/**/__tests__/**/*.test.ts',
      'components/**/__tests__/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.mjs',
    ],
  },
})
