import { test, expect, anmelden, assistentDurchlaufen, syncAbwarten } from './support/fixtures'
import { kontoExistiert, kontoLoeschen, neueAdresse, PASSWORT } from './support/konto'
import { linkAusMail, mailAbwarten } from './support/mail'

test('Registrierung: Schlüssel sichern, Mail bestätigen, anmelden', async ({ page }) => {
  const email = neueAdresse('neu')
  try {
    await page.goto('./')
    await page.getByRole('button', { name: 'Neues Konto anlegen' }).click()
    await page.getByLabel('E-Mail').fill(email)
    await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT)
    await page.getByLabel('Passwort wiederholen').fill(PASSWORT)
    await page.getByRole('button', { name: 'Konto anlegen' }).click()

    // Der Wiederherstellungsschlüssel wird einmal gezeigt; die dritte Gruppe muss abgetippt werden.
    const code = (await page.locator('p.font-mono').innerText()).trim()
    expect(code).toMatch(/^([A-Z2-7]{4}-){6}[A-Z2-7]{2}$/)
    await page.getByLabel('Dritte Gruppe zur Bestätigung').fill(code.split('-')[2])
    await page.getByRole('button', { name: 'Ich habe den Schlüssel gesichert' }).click()
    await expect(page.getByRole('heading', { name: 'Fast geschafft' })).toBeVisible()

    // Ohne bestätigte Adresse kein Login
    await page.getByRole('button', { name: 'Zur Anmeldung' }).click()
    await anmelden(page, { email, passwort: PASSWORT } as never)
    await expect(page.getByRole('alert')).toContainText('bestätige zuerst deine E-Mail')

    const mail = await mailAbwarten(email)
    await page.goto(linkAusMail(mail.text))
    await expect(page.getByRole('status')).toContainText('E-Mail bestätigt')

    await anmelden(page, { email, passwort: PASSWORT } as never)
    await assistentDurchlaufen(page)
  } finally {
    await kontoLoeschen(email)
  }
})

test('falsches Passwort wird abgewiesen, ohne etwas zu verraten', async ({ page, konto }) => {
  await anmelden(page, konto, 'Falsches-Passwort-123')
  await expect(page.getByRole('alert')).toHaveText('E-Mail oder Passwort stimmt nicht.')
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
})

test('Passwort vergessen: Link aus der Mail, Wiederherstellungsschlüssel, neues Passwort', async ({
  page,
  konto,
}) => {
  const neu = 'Ganz-neues-Passwort-2'
  await page.goto('./')
  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  await page.getByLabel('E-Mail').fill(konto.email)
  await page.getByRole('button', { name: 'Link senden' }).click()
  await expect(page.getByText('ist ein Link unterwegs')).toBeVisible()

  const mail = await mailAbwarten(konto.email)
  await page.goto(linkAusMail(mail.text))
  await expect(page.getByRole('heading', { name: 'Neues Passwort festlegen' })).toBeVisible()

  // Falscher Schlüssel scheitert, der richtige setzt das neue Passwort
  await page.getByLabel('Wiederherstellungsschlüssel').fill('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG')
  await page.getByLabel('Neues Passwort').fill(neu)
  await page.getByRole('button', { name: 'Passwort ändern' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByLabel('Wiederherstellungsschlüssel').fill(konto.recoveryCode)
  await page.getByRole('button', { name: 'Passwort ändern' }).click()
  await assistentDurchlaufen(page)

  // Abmelden, mit dem alten Passwort geht nichts mehr, mit dem neuen schon
  await syncAbwarten(page)
  await page.getByRole('link', { name: 'Einstellungen' }).click()
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await anmelden(page, konto)
  await expect(page.getByRole('alert')).toHaveText('E-Mail oder Passwort stimmt nicht.')
  await anmelden(page, konto, neu)
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
  expect(await kontoExistiert(konto.email)).toBe(true)
})
