import type { Page } from '@playwright/test'
import { PAGES } from '../src/pages'
import { anmelden, expect, test } from './support/fixtures'

// Chromium auf dem CI-Runner ist die Referenz; Referenzbilder entstehen im Workflow «Referenzbilder»,
// nicht auf dem eigenen Rechner (Schrift und Rasterung weichen sonst ab).
const BREITEN = [375, 768, 1280] as const
const SCHEMEN = ['hell', 'dunkel'] as const
const SEITEN = [
  ...PAGES.map((p) => p.path),
  '/datenschutz',
  '/budget?ansicht=kategorien',
  '/einstellungen?bereich=daten',
  '/einstellungen?bereich=konto',
]

/** Wie `assistentDurchlaufen`, aber ohne Hauptnavigation zu verlangen: auf dem Handy ist sie eingeklappt. */
async function einrichten(page: Page) {
  await expect(page.getByRole('heading', { name: 'Willkommen bei StudiBudget' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('radio', { name: /^WG/ }).check()
  await page.getByLabel('Mitbewohner/in 1').fill('Anna')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByLabel(/Betrag/)).toBeVisible()
}

async function buchen(
  page: Page,
  betrag: string,
  kategorie: string,
  notiz: string,
  geteilt = false,
) {
  await page.getByLabel(/Betrag/).fill(betrag)
  await page.getByLabel('Kategorie').selectOption({ label: kategorie })
  await page.getByLabel(/Notiz/).fill(notiz)
  if (geteilt) await page.getByLabel('Gemeinsame Ausgabe').check()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(notiz)).toBeVisible()
}

for (const schema of SCHEMEN) {
  for (const breite of BREITEN) {
    test.describe(`visuell ${schema} ${breite}`, () => {
      test.skip(({ browserName }) => browserName !== 'chromium', 'Referenzbilder nur für Chromium')
      test.use({
        colorScheme: schema === 'hell' ? 'light' : 'dark',
        viewport: { width: breite, height: 900 },
      })

      test('Seiten sehen aus wie das Referenzbild', async ({ page, konto }) => {
        // Feste Uhr in der Vergangenheit: gleiche Monatsansicht, und das Anmelde-Token läuft nicht ab.
        await page.clock.setFixedTime(new Date('2026-03-18T10:00:00+01:00'))
        const aufnehmen = async (name: string) => {
          await page.evaluate(() => document.fonts.ready)
          await expect(page).toHaveScreenshot(`${name}-${schema}-${breite}.png`, {
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: 0.01,
            mask: [
              page.getByRole('button', {
                name: /^(Synchronisiert|Offline|\d+ Änderung(en)? ausstehend)/,
              }),
              page.getByRole('status'),
            ],
          })
        }

        await page.goto('./')
        await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
        await aufnehmen('anmelden')

        await anmelden(page, konto)
        await einrichten(page)
        await buchen(page, '23.50', 'Einkauf zuhause', 'Migros')
        await buchen(page, '12.30', 'Mensa / Mittagessen', 'Mensa Dienstag')
        await buchen(page, '90', 'Einkauf zuhause', 'Wocheneinkauf', true)

        for (const seite of SEITEN) {
          await page.goto(`./#${seite}`)
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
          await aufnehmen(seite.slice(1).replace(/\?[a-z]+=/, '-'))
        }
      })
    })
  }
}
