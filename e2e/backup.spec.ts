import { readFileSync } from 'node:fs'
import { expect, test } from './support/fixtures'

test('Backup exportieren, Daten löschen, Backup wieder einspielen', async ({
  eingerichtet: { page },
}, testInfo) => {
  await page.getByLabel(/Betrag/).fill('23.50')
  await page.getByLabel('Kategorie').selectOption({ label: 'Einkauf zuhause' })
  await page.getByLabel(/Notiz/).fill('Migros')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Migros')).toBeVisible()

  await page.getByRole('link', { name: 'Einstellungen' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Backup herunterladen' }).click()
  const datei = testInfo.outputPath('backup.json')
  await (await download).saveAs(datei)
  await expect(page.getByText('Das Backup wurde heruntergeladen.')).toBeVisible()
  expect(JSON.parse(readFileSync(datei, 'utf8')).data.transactions).toHaveLength(1)

  // Buchung löschen (die App fragt nach, der Dialog wird in der Fixture bestätigt)
  await page.getByRole('link', { name: 'Eingabe' }).click()
  await page.getByRole('button', { name: /Löschen/ }).click()
  await expect(page.getByText('Migros')).toBeHidden()

  await page.getByRole('link', { name: 'Einstellungen' }).click()
  await page.getByLabel('Backup einspielen').setInputFiles(datei)
  const inhalt = page.getByRole('region', { name: 'Inhalt des Backups' })
  await expect(inhalt).toContainText('1 Buchungen')
  await inhalt.getByRole('button', { name: 'Alle Daten durch dieses Backup ersetzen' }).click()
  await expect(page.getByText('Das Backup wurde eingespielt.')).toBeVisible()

  await page.getByRole('link', { name: 'Eingabe' }).click()
  await expect(page.getByText('Migros')).toBeVisible()
})
