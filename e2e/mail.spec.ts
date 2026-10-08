import { expect, test } from '@playwright/test'
import { linkOhneToken, neuesteMail } from './support/mail'

const kopf = (ID: string, an: string, Created: string) => ({
  ID,
  To: [{ Address: an }],
  Subject: ID,
  Created,
})

test('AK-3 (#116): bei mehreren Mails an dieselbe Adresse gilt die neueste', () => {
  const mails = [
    kopf('alt', 'Lena@test.local', '2026-10-08T10:00:00.000Z'),
    kopf('neu', 'lena@test.local', '2026-10-08T10:00:05.000Z'),
    kopf('fremd', 'anna@test.local', '2026-10-08T10:00:09.000Z'),
  ]
  expect(neuesteMail(mails, 'lena@test.local')?.ID).toBe('neu')
  expect(neuesteMail([...mails].reverse(), 'lena@test.local')?.ID).toBe('neu')
  expect(neuesteMail(mails, 'niemand@test.local')).toBeUndefined()
})

test('AK-2 (#116): die Link-Adresse für die Fehlermeldung enthält keine Token', () => {
  const link =
    'http://localhost:54321/auth/v1/verify?token=geheim123&type=recovery&redirect_to=http://localhost:4173/studibudget/'
  const kurz = linkOhneToken(link)
  expect(kurz).not.toContain('geheim123')
  expect(kurz).toContain('/auth/v1/verify')
  expect(kurz).toContain('type=recovery')
  expect(linkOhneToken('http://localhost:4173/studibudget/#access_token=abc&type=recovery')).toBe(
    'http://localhost:4173/studibudget/#access_token=…&type=recovery',
  )
})
