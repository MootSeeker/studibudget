import type { Browser, Page } from '@playwright/test'
import { anmelden, expect, syncAbwarten, test } from './support/fixtures'
import type { Konto } from './support/konto'

/** Zweites Gerät: eigener Browser-Kontext (eigener lokaler Speicher), gleiches Konto. */
async function zweitesGeraet(browser: Browser, baseURL: string | undefined, a: Page, konto: Konto) {
  // Die Einstellungen des ersten Geräts müssen auf dem Server sein, bevor sich das zweite anmeldet.
  await syncAbwarten(a)
  const context = await browser.newContext({
    baseURL,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  })
  const page = await context.newPage()
  page.on('dialog', (d) => void d.accept())
  await anmelden(page, konto)
  // Neues Gerät: die Einstellungen kommen aus dem Konto, der Assistent entfällt.
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
  return { context, page }
}

async function buchen(page: Page, betrag: string, notiz: string) {
  await page.getByLabel(/Betrag/).fill(betrag)
  await page.getByLabel('Kategorie').selectOption({ label: 'Einkauf zuhause' })
  await page.getByLabel(/Notiz/).fill(notiz)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(notiz)).toBeVisible()
}

async function notizAendern(page: Page, alt: string, neu: string) {
  await page.getByRole('link', { name: 'Eingabe' }).click()
  await page.getByRole('button', { name: `Bearbeiten ${alt}` }).click()
  const form = page.getByRole('form', { name: 'Buchung bearbeiten' })
  await form.getByLabel(/Notiz/).fill(neu)
  await form.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(neu)).toBeVisible()
}

async function abgleichen(page: Page) {
  await syncAbwarten(page)
}

test('zwei Geräte: was auf A gebucht wird, erscheint auf B', async ({
  eingerichtet: { page: a, konto },
  browser,
  baseURL,
}) => {
  const { context, page: b } = await zweitesGeraet(browser, baseURL, a, konto)
  try {
    await buchen(a, '18.40', 'Kaffeebohnen')
    await abgleichen(a)
    await abgleichen(b)
    await expect(b.getByText('Kaffeebohnen')).toBeVisible()
  } finally {
    await context.close()
  }
})

test('zwei Geräte: bei gleichzeitigen Änderungen gewinnt die spätere', async ({
  eingerichtet: { page: a, konto },
  browser,
  baseURL,
}) => {
  const { context, page: b } = await zweitesGeraet(browser, baseURL, a, konto)
  try {
    await buchen(a, '9', 'Ausgangstext')
    await abgleichen(a)
    await abgleichen(b)
    await expect(b.getByText('Ausgangstext')).toBeVisible()

    await context.setOffline(true)
    await notizAendern(a, 'Ausgangstext', 'Text von A')
    await abgleichen(a)
    // B ändert danach, ohne A zu kennen
    await notizAendern(b, 'Ausgangstext', 'Text von B')
    await context.setOffline(false)
    await abgleichen(b)
    await abgleichen(a)

    await a.getByRole('link', { name: 'Eingabe' }).click()
    await expect(a.getByText('Text von B')).toBeVisible()
    await expect(a.getByText('Text von A')).toBeHidden()
    await expect(b.getByText('Text von B')).toBeVisible()
    await expect(b.getByText('Text von A')).toBeHidden()
  } finally {
    await context.close()
  }
})

test('offline: Änderung bleibt vorgemerkt und kommt beim Wiederverbinden auf B an', async ({
  eingerichtet: { page: a, konto },
  browser,
  baseURL,
}) => {
  const { context, page: b } = await zweitesGeraet(browser, baseURL, a, konto)
  try {
    await a.context().setOffline(true)
    await buchen(a, '5.50', 'Offline-Gipfeli')
    await expect(a.getByRole('button', { name: /1 Änderung ausstehend/ })).toBeVisible()

    await a.context().setOffline(false)
    await abgleichen(a)
    await abgleichen(b)
    await expect(b.getByText('Offline-Gipfeli')).toBeVisible()
  } finally {
    await context.close()
  }
})

test('zurücksetzen auf A löscht die Buchungen auch auf B', async ({
  eingerichtet: { page: a, konto },
  browser,
  baseURL,
}) => {
  const { context, page: b } = await zweitesGeraet(browser, baseURL, a, konto)
  try {
    await buchen(a, '14', 'Wird gelöscht')
    await abgleichen(a)
    await abgleichen(b)
    await expect(b.getByText('Wird gelöscht')).toBeVisible()

    await a.getByRole('link', { name: 'Einstellungen' }).click()
    await a.getByRole('button', { name: 'Zurücksetzen …' }).click()
    const dialog = a.getByRole('dialog', { name: 'Daten zurücksetzen' })
    await dialog.getByRole('checkbox', { name: /^Buchungen \(1\)/ }).check()
    await dialog.getByRole('button', { name: '1 Eintrag löschen' }).click()
    await expect(a.getByText('1 Eintrag gelöscht.')).toBeVisible()
    await abgleichen(a)

    await abgleichen(b)
    await expect(b.getByText('Wird gelöscht')).toBeHidden()
  } finally {
    await context.close()
  }
})

test('PWA: nach dem Laden startet die App offline aus dem Cache mit den lokalen Daten', async ({
  eingerichtet: { page },
  browserName,
}) => {
  // Nur Chromium: Playwright schaltet den Service Worker in WebKit nicht verlässlich offline-fähig.
  test.skip(browserName !== 'chromium', 'Service-Worker-Offline-Test nur in Chromium')
  await buchen(page, '7', 'Aus dem Cache')
  await syncAbwarten(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // jetzt steuert der Service Worker die Seite

  await page.context().setOffline(true)
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
  await page.getByRole('link', { name: 'Monat', exact: true }).click()
  await expect(page.getByText('Aus dem Cache').first()).toBeVisible()
  await page.context().setOffline(false)
})
