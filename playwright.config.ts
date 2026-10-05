import { defineConfig, devices } from '@playwright/test'
import { supabaseUmgebung } from './e2e/support/umgebung'

// Die Adressen des lokalen Supabase gehören in den Build (und damit in die Content-Security-Policy der Seite).
const sb = supabaseUmgebung()
process.env.VITE_SUPABASE_URL = sb.url
process.env.VITE_SUPABASE_ANON_KEY = sb.anonKey

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  // Das lokale Supabase ist ein gemeinsamer Zustand; jedes Konto ist eigen, aber der Mail-Fänger ist es nicht.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Ein zweiter Versuch fängt nichts zu; er macht Wackler sichtbar: `--fail-on-flaky-tests` (siehe package.json).
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [
        ['github'],
        [
          'html',
          { open: 'never', outputFolder: `reports/e2e-${process.env.E2E_BROWSER ?? 'lokal'}/html` },
        ],
      ]
    : [['list']],
  outputDir: 'test-results',
  // Referenzbilder ohne Plattform im Namen; in der CI wird nie still ein neues Bild angelegt.
  snapshotPathTemplate: '{testDir}/referenz/{arg}{ext}',
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  use: {
    baseURL: `http://localhost:${PORT}/studibudget/`,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Bestätigungsfragen (confirm) der App werden in den Tests ausdrücklich behandelt.
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build:e2e && npm run preview:e2e`,
    url: `http://localhost:${PORT}/studibudget/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
