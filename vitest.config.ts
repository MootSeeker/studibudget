import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

const testFiles = ['src/**/*.test.{ts,tsx}']
// `e2e/` gehört Playwright, `*.db.test.ts` braucht das lokale Supabase.
const notDb = [...configDefaults.exclude, 'e2e/**', '**/*.db.test.ts']

/**
 * Drei Projekte, immer mit `--project` aufrufen (siehe package.json):
 * - unit: schnelle Tests mit jsdom
 * - slow: dieselben Tests mit künstlich verlangsamter Datenbank (siehe src/test/setup.ts), findet Zeitfehler der CI
 * - db: Tests gegen das lokale Supabase (braucht Docker und `npx supabase start`)
 */
export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      globals: true,
      includeTaskLocation: true,
      tags: [
        { name: 'regression', description: 'Sichert einen behobenen Fehler (Issue im Namen)' },
        { name: 'property', description: 'Eigenschaftsbasierter Test (fast-check)' },
        { name: 'negativ', description: 'Fehlerpfad: ungültige oder manipulierte Eingabe' },
      ],
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
            include: testFiles,
            exclude: notDb,
            // Auf langsamen Rechnern (CI) brauchen die Seitentests, die aus IndexedDB lesen, deutlich länger als lokal.
            testTimeout: 15_000,
          },
        },
        {
          extends: true,
          test: {
            name: 'slow',
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
            include: testFiles,
            exclude: [...notDb, '**/*.prop.test.ts'],
            env: { SLOW_DB: process.env.SLOW_DB ?? '150' },
            testTimeout: 30_000,
          },
        },
        {
          extends: true,
          test: {
            name: 'db',
            environment: 'node',
            include: ['src/**/*.db.test.ts'],
            testTimeout: 30_000,
          },
        },
      ],
    },
  }),
)
