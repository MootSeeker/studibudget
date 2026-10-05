import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

/**
 * Eigene Config für Stryker: ohne Projekte (sonst läuft jede Test-Datei mehrfach), ohne Coverage und ohne Berichte.
 * Nur die Tests der Bereiche, die mutiert werden; Seitentests (jsdom, UI) sind für Mutationen zu langsam und zu zeitabhängig.
 */
export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      globals: true,
      name: 'unit',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/{domain,crypto,sync,data}/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/*.db.test.ts'],
      testTimeout: 15_000,
      reporters: ['default'],
      tags: [{ name: 'regression' }, { name: 'property' }, { name: 'negativ' }],
    },
  }),
)
