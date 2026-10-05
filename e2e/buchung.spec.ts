import { test, expect } from './support/fixtures'
import type { Page } from '@playwright/test'

/** Zahlen ohne Rücksicht auf das Tausendertrennzeichen der Engine (’ oder ') und geschützte Leerzeichen. */
const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ').replace('’', "'")

test('Buchung erfassen → Monat → Statistik', async ({ eingerichtet: { page } }) => {
  await page.getByLabel(/Betrag/).fill('23.50')
  await page.getByLabel('Kategorie').selectOption({ label: 'Einkauf zuhause' })
  await page.getByLabel(/Notiz/).fill('Migros')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Migros')).toBeVisible()
  await expect(page.getByLabel(/Betrag/)).toHaveValue('')

  await page.getByRole('link', { name: 'Monat', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Monat' })).toBeVisible()
  const saldo = page.getByRole('row', { name: /Ausgaben/ }).first()
  await expect(saldo).toContainText(/CHF\s23\.50/)

  await page.getByRole('link', { name: 'Statistik' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Statistik' })).toBeVisible()
  const ausgaben = page.locator('dt', { hasText: /^Ausgaben$/ }).locator('..')
  await expect(ausgaben).toContainText(/CHF\s23\.50/)
  expect(norm(await ausgaben.innerText())).toMatch(/CHF\s23\.50/)
})

async function buchen(page: Page, betrag: string, kategorie: string, notiz: string) {
  await page.getByLabel(/Betrag/).fill(betrag)
  await page.getByLabel('Kategorie').selectOption({ label: kategorie })
  await page.getByLabel(/Notiz/).fill(notiz)
}

test('Fixkosten-Vorlage: einmal anlegen, im Vormonat prüfen und buchen', async ({
  eingerichtet: { page },
}) => {
  await buchen(page, '800', 'Miete', 'Miete WG')
  await page.getByLabel(/Wiederholen/).check()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Miete WG')).toBeVisible()

  await page.getByRole('button', { name: 'Vorheriger Monat' }).click()
  const hinweis = page.getByText(/Fixkosten für .* buchen\?/)
  await expect(hinweis).toContainText('(1 offen)')
  await page.getByRole('button', { name: 'Prüfen und buchen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Betrag Miete')).toHaveValue('800.00')
  await dialog.getByLabel('Betrag Miete').fill('820')
  await dialog.getByRole('button', { name: 'Buchen' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Miete WG')).toBeVisible()
  await expect(page.getByText(/Fixkosten für .* buchen\?/)).toBeHidden()
})

test('geteilte Ausgabe in der WG: Anna schuldet die Hälfte, Ausgleich stellt es glatt', async ({
  eingerichtet: { page },
}) => {
  await buchen(page, '90', 'Einkauf zuhause', 'Wocheneinkauf')
  await page.getByLabel('Gemeinsame Ausgabe').check()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(/bezahlt von mir/)).toBeVisible()
  await expect(page.getByText(/bezahlt von mir/).locator('xpath=ancestor::li')).toContainText(
    /CHF\s45\.00/,
  )

  await page.getByRole('link', { name: 'Ausgleich' }).click()
  await expect(page.getByText(/^Anna schuldet dir CHF\s45\.00\.$/)).toBeVisible()
  await page.getByRole('button', { name: 'Anna ausgleichen' }).click()
  const formular = page.getByRole('form', { name: 'Ausgleichszahlung erfassen' })
  await formular.getByRole('button', { name: 'Speichern' }).click()
  await expect(formular.getByRole('status')).toHaveText('Gespeichert.')
  await expect(page.getByText('Mit Anna bist du ausgeglichen.')).toBeVisible()
})
