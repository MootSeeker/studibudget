import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { PAGES } from '../src/pages'
import { anmelden, expect, test } from './support/fixtures'

// WCAG 2.0, 2.1 und 2.2, jeweils A und AA. Ausnahmen gehören in AUSNAHMEN und tragen eine Issue-Nummer.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const AUSNAHMEN: { regel: string; issue: string }[] = []

interface Befund {
  ort: string
  regel: string
  folgen: string
  elemente: string[]
}

async function pruefen(page: Page, ort: string, befunde: Befund[]) {
  const ergebnis = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(AUSNAHMEN.map((a) => a.regel))
    .analyze()
  for (const v of ergebnis.violations)
    befunde.push({
      ort,
      regel: v.id,
      folgen: v.impact ?? '',
      elemente: v.nodes.map((n) => n.target.join(' ')),
    })
}

async function berichten(befunde: Befund[], testInfo: TestInfo) {
  await testInfo.attach('axe-verstoesse.json', {
    body: JSON.stringify(befunde, null, 2),
    contentType: 'application/json',
  })
  expect(befunde, JSON.stringify(befunde, null, 2)).toEqual([])
}

const VARIANTEN = [
  { name: 'hell, Desktop', colorScheme: 'light', viewport: { width: 1280, height: 800 } },
  { name: 'dunkel, Desktop', colorScheme: 'dark', viewport: { width: 1280, height: 800 } },
  { name: 'hell, Handy', colorScheme: 'light', viewport: { width: 390, height: 844 } },
  { name: 'dunkel, Handy', colorScheme: 'dark', viewport: { width: 390, height: 844 } },
] as const

for (const v of VARIANTEN) {
  test.describe(`Barrierefreiheit (${v.name})`, () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'axe läuft nur in Chromium')
    test.use({ colorScheme: v.colorScheme, viewport: v.viewport })

    test('ohne Anmeldung: Anmelden, Konto anlegen, Passwort vergessen, Fehler, Datenschutz', async ({
      page,
      konto,
    }, testInfo) => {
      const befunde: Befund[] = []
      await page.goto('./')
      await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
      await pruefen(page, 'Anmelden', befunde)

      await anmelden(page, konto, 'Falsches-Passwort-123')
      await expect(page.getByRole('alert')).toBeVisible()
      await pruefen(page, 'Anmelden mit Fehlermeldung', befunde)

      await page.getByRole('button', { name: 'Neues Konto anlegen' }).click()
      await expect(page.getByRole('button', { name: 'Konto anlegen' })).toBeVisible()
      await pruefen(page, 'Konto anlegen', befunde)

      await page.goto('./')
      await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
      await expect(page.getByRole('button', { name: 'Link senden' })).toBeVisible()
      await pruefen(page, 'Passwort vergessen', befunde)

      await page.goto('./#/datenschutz')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await pruefen(page, 'Datenschutz', befunde)
      await berichten(befunde, testInfo)
    })

    test('angemeldet: Assistent, alle Seiten, Menü, Fehlerzustand', async ({
      page,
      konto,
    }, testInfo) => {
      const befunde: Befund[] = []
      await anmelden(page, konto)
      await expect(page.getByRole('heading', { name: 'Willkommen bei StudiBudget' })).toBeVisible()
      await pruefen(page, 'Assistent', befunde)
      await page.getByRole('button', { name: 'Weiter' }).click()
      await page.getByRole('radio', { name: /^WG/ }).check()
      await page.getByLabel('Mitbewohner/in 1').fill('Anna')
      await pruefen(page, 'Assistent, WG', befunde)
      await page.getByRole('button', { name: 'Weiter' }).click()
      await page.getByRole('button', { name: 'Weiter' }).click()
      await page.getByRole('button', { name: 'Fertig' }).click()

      const handy = v.viewport.width < 768
      if (handy) {
        await page.getByRole('button', { name: 'Menü', exact: true }).click()
        await pruefen(page, 'Menü offen (Handy)', befunde)
        await page.getByRole('button', { name: 'Menü schliessen' }).click()
      } else {
        await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
      }

      // Fehlerzustand: leeres Formular speichern
      await page.getByRole('button', { name: 'Speichern' }).click()
      await pruefen(page, 'Eingabe mit Fehlern', befunde)

      // Offener Dialog «Daten zurücksetzen»
      await page.goto('./#/einstellungen')
      await page.getByRole('button', { name: 'Zurücksetzen …' }).click()
      await expect(page.getByRole('dialog', { name: 'Daten zurücksetzen' })).toBeVisible()
      await pruefen(page, 'Dialog Daten zurücksetzen', befunde)
      await page.keyboard.press('Escape')

      for (const seite of [...PAGES.map((p) => p.path), '/datenschutz', '/impressum']) {
        await page.goto(`./#${seite}`)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await pruefen(page, seite, befunde)
      }
      await berichten(befunde, testInfo)
    })
  })
}
