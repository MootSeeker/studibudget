import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { AuthError, register } from './flows'

/** Ein Client, dessen Registrierung mit der gegebenen Server-Meldung scheitert. */
const clientFailing = (message: string, status = 422) =>
  ({
    auth: { signUp: async () => ({ data: null, error: { message, status } }) },
  }) as unknown as SupabaseClient

describe('Meldungen bei der Registrierung', () => {
  const PW = 'ein-langes-passwort-123'
  const cases: [string, string][] = [
    ['Signups not allowed for this instance', 'Registrierung ist im Moment geschlossen'],
    ['signup_disabled', 'Registrierung ist im Moment geschlossen'],
    ['Email signups are disabled', 'Registrierung ist im Moment geschlossen'],
    ['email rate limit exceeded', 'Zu viele Versuche'],
    ['TypeError: Failed to fetch', 'Keine Verbindung'],
  ]
  it.each(cases)('«%s» → verständliche Meldung', async (serverMessage, expected) => {
    const err = await register(clientFailing(serverMessage), 'a@b.ch', PW, 'http://x/').catch(
      (e) => e,
    )
    expect(err).toBeInstanceOf(AuthError)
    expect(err.message).toContain(expected)
  })
  it('zu kurzes Passwort wird vor dem Server abgelehnt', async () => {
    await expect(
      register(clientFailing('egal'), 'a@b.ch', 'kurz', 'http://x/'),
    ).rejects.toMatchObject({ code: 'weak' })
  })
})
