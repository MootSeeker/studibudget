import { test, expect } from './support/fixtures'

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
  await expect(saldo).toContainText(/CHF 23\.50/)

  await page.getByRole('link', { name: 'Statistik' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Statistik' })).toBeVisible()
  const ausgaben = page.locator('dt', { hasText: /^Ausgaben$/ }).locator('..')
  await expect(ausgaben).toContainText(/CHF 23\.50/)
  expect(norm(await ausgaben.innerText())).toMatch(/CHF 23\.50/)
})
