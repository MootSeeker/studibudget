import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config.ts'

/** Nur das Projekt `unit`, ohne Coverage und ohne Berichte: Stryker führt die Tests tausendfach aus. */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: { enabled: false, thresholds: {} },
      reporters: ['default'],
      projects: undefined,
      name: 'unit',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/{domain,crypto,sync,data}/**/*.test.ts'],
      exclude: ['e2e/**', '**/*.db.test.ts', '**/node_modules/**'],
      testTimeout: 15_000,
    },
  }),
)
