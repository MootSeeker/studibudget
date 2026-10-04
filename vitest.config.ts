import { readFileSync } from 'node:fs'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

type Bereich = { glob: string; schwelle?: Record<string, number> }
const areas: { bereiche: Bereich[] } = JSON.parse(
  readFileSync(new URL('./scripts/coverage-areas.json', import.meta.url), 'utf8'),
)
const thresholds = Object.fromEntries(
  areas.bereiche.filter((a) => a.schwelle).map((a) => [a.glob, a.schwelle]),
)
// Berichtsordner pro CI-Job (reports/<suite>/), damit sich die Läufe nicht überschreiben.
const suite = process.env.TEST_SUITE ?? 'unit'

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
      reporters: process.env.CI
        ? [
            'default',
            ['github-actions', { jobSummary: { enabled: false } }],
            'junit',
            'json',
            ['html', { outputDir: `reports/${suite}/html` }],
          ]
        : ['default'],
      outputFile: { junit: `reports/${suite}/junit.xml`, json: `reports/${suite}/results.json` },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/domain/types.ts'],
        reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
        reportsDirectory: 'reports/coverage',
        reportOnFailure: true,
        thresholds,
      },
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
