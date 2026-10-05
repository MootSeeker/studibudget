import { anmelden, expect, test } from './support/fixtures'
import { kontoExistiert } from './support/konto'

const NEU = 'Ganz-neues-Passwort-2'

test('Passwort ändern: das alte gilt nicht mehr, das neue öffnet dieselben Daten', async ({
  eingerichtet: { page, konto },
}) => {
  await page.getByLabel(/Betrag/).fill('12.30')
  await page.getByLabel('Kategorie').selectOption({ label: 'Mensa / Mittagessen' })
  await page.getByLabel(/Notiz/).fill('Mensa Dienstag')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Mensa Dienstag')).toBeVisible()

  await page.getByRole('link', { name: 'Einstellungen' }).click()
  const bereich = page.locator('details', { hasText: 'Passwort ändern' }).first()
  await bereich.locator('summary').click()
  await bereich.getByLabel('Aktuelles Passwort').fill(konto.passwort)
  await bereich.getByLabel('Neues Passwort').fill(NEU)
  await bereich.getByRole('button', { name: 'Passwort ändern' }).click()
  await expect(bereich.getByRole('status')).toHaveText('Passwort geändert.')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await anmelden(page, konto)
  await expect(page.getByRole('alert')).toHaveText('E-Mail oder Passwort stimmt nicht.')
  await anmelden(page, konto, NEU)
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
  await expect(page.getByText('Mensa Dienstag')).toBeVisible()
})

test('Konto löschen: Konto und Daten sind weg', async ({ eingerichtet: { page, konto } }) => {
  await page.getByRole('link', { name: 'Einstellungen' }).click()
  const bereich = page.locator('details', { hasText: 'Konto endgültig löschen' })
  await bereich.locator('summary').click()
  await bereich.getByLabel('Passwort zur Bestätigung').fill(konto.passwort)
  await bereich.getByRole('button', { name: 'Konto endgültig löschen' }).click()
  await expect(page.getByRole('status')).toContainText('Dein Konto und alle Daten sind gelöscht.')
  expect(await kontoExistiert(konto.email)).toBe(false)
  await anmelden(page, konto)
  await expect(page.getByRole('alert')).toHaveText('E-Mail oder Passwort stimmt nicht.')
})

test('Abmelden leert die Daten auf dem Gerät', async ({ eingerichtet: { page } }) => {
  await page.getByLabel(/Betrag/).fill('5')
  await page.getByLabel('Kategorie').selectOption({ label: 'Mensa / Mittagessen' })
  await page.getByLabel(/Notiz/).fill('Mensa Dienstag')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Mensa Dienstag')).toBeVisible()
  const zeilen = () =>
    page.evaluate(
      () =>
        new Promise<number>((fertig, fehler) => {
          const anfrage = indexedDB.open('studibudget')
          anfrage.onerror = () => fehler(anfrage.error)
          anfrage.onsuccess = () => {
            const d = anfrage.result
            const stores = [...d.objectStoreNames]
            if (stores.length === 0) return fertig(0)
            const t = d.transaction(stores, 'readonly')
            let summe = 0
            let offen = stores.length
            for (const s of stores) {
              const z = t.objectStore(s).count()
              z.onsuccess = () => {
                summe += z.result
                if (--offen === 0) {
                  d.close()
                  fertig(summe)
                }
              }
            }
          }
        }),
    )
  expect(await zeilen()).toBeGreaterThan(0)

  await page.getByRole('link', { name: 'Einstellungen' }).click()
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
  expect(await zeilen()).toBe(0)
})
