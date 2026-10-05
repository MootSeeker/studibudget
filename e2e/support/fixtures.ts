import { expect, test as basis, type Page } from '@playwright/test'
import { kontoAnlegen, kontoLoeschen, type Konto } from './konto'

/** Meldet an und führt durch den Einrichtungsassistenten (Schweiz, WG mit «Anna», keine Budgets). */
export async function anmelden(page: Page, konto: Konto, passwort = konto.passwort) {
  await page.goto('./')
  await page.getByLabel('E-Mail').fill(konto.email)
  await page.getByLabel('Passwort').fill(passwort)
  await page.getByRole('button', { name: 'Anmelden' }).click()
}

/** Wartet, bis alle Änderungen auf dem Server sind; wer sich danach abmeldet, verliert nichts. */
export async function syncAbwarten(page: Page) {
  const knopf = page.getByRole('button', { name: /^(Synchronisiert|\d+ Änderungen? ausstehend)/ })
  await knopf.click()
  await expect(page.getByRole('button', { name: 'Synchronisiert', exact: true })).toBeVisible()
}

export async function assistentDurchlaufen(page: Page, wohnen: 'Allein' | 'WG' = 'WG') {
  await expect(page.getByRole('heading', { name: 'Willkommen bei StudiBudget' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click() // Land: Schweiz
  await page.getByRole('radio', { name: new RegExp(`^${wohnen}`) }).check()
  if (wohnen === 'WG') await page.getByLabel('Mitbewohner/in 1').fill('Anna')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click() // Semester
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
}

interface Fixtures {
  konto: Konto
  /** Angemeldetes Konto mit durchlaufenem Assistenten. */
  eingerichtet: { page: Page; konto: Konto }
}

export const test = basis.extend<Fixtures>({
  // Bestätigungsfragen der App («wirklich löschen?») gelten in den Tests als bestätigt.
  page: async ({ page }, use) => {
    page.on('dialog', (d) => void d.accept())
    await use(page)
  },
  konto: async ({}, use) => {
    const konto = await kontoAnlegen()
    await use(konto)
    await kontoLoeschen(konto.email)
  },
  eingerichtet: async ({ page, konto }, use) => {
    await anmelden(page, konto)
    await assistentDurchlaufen(page)
    await use({ page, konto })
  },
})

export { expect }
