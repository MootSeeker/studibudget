import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createAccountKeys } from '../crypto/keys'
import { AuthError, changeEmail, register } from './flows'

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

describe('E-Mail-Adresse ändern (Issue #188)', () => {
  it('AK-3: ungültig, gleich wie aktuell und falsches Passwort', async () => {
    const keys = await createAccountKeys('Richtiges-Passwort-1', 'lena@test.local')
    const updateUser = vi.fn(async () => ({ data: {}, error: null }))
    const sb = {
      from: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: {
              wrapped_dek: keys.wrappedDek,
              wrapped_dek_recovery: keys.wrappedDekRecovery,
              kdf: keys.kdf,
            },
            error: null,
          }),
        }),
      }),
      auth: { updateUser },
    } as unknown as SupabaseClient
    const fehler = (p: Promise<unknown>) =>
      p.then(
        () => null,
        (e: unknown) => e,
      )

    const ungueltig = await fehler(
      changeEmail(sb, 'lena@test.local', 'Richtiges-Passwort-1', 'abc'),
    )
    expect(ungueltig).toBeInstanceOf(AuthError)
    expect((ungueltig as AuthError).message).toBe('Bitte gib eine gültige E-Mail-Adresse ein.')

    const gleich = await fehler(
      changeEmail(sb, 'lena@test.local', 'Richtiges-Passwort-1', ' Lena@Test.local '),
    )
    expect((gleich as AuthError).message).toBe('Das ist bereits deine Adresse.')

    const falsch = await fehler(
      changeEmail(sb, 'lena@test.local', 'Falsches-Passwort-9', 'neu@test.local'),
    )
    expect(falsch).toBeInstanceOf(AuthError)
    expect((falsch as AuthError).code).toBe('invalid')
    expect((falsch as AuthError).message).toBe('Das Passwort stimmt nicht.')

    expect(updateUser).not.toHaveBeenCalled()
  }, 30000)

  it('AK-3: scheitert das Speichern der Schlüssel, werden Adresse und Passwort zurückgesetzt', async () => {
    const keys = await createAccountKeys('Richtiges-Passwort-1', 'lena@test.local')
    const updateUser = vi.fn(async () => ({ data: {}, error: null }))
    const sb = {
      from: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: {
              wrapped_dek: keys.wrappedDek,
              wrapped_dek_recovery: keys.wrappedDekRecovery,
              kdf: keys.kdf,
            },
            error: null,
          }),
        }),
        update: () => ({ eq: async () => ({ error: { message: 'Speicher voll' } }) }),
      }),
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
        updateUser,
      },
    } as unknown as SupabaseClient

    await expect(
      changeEmail(sb, 'lena@test.local', 'Richtiges-Passwort-1', 'neu@test.local'),
    ).rejects.toThrow('Speicher voll')
    expect(updateUser).toHaveBeenCalledTimes(2)
    expect(updateUser).toHaveBeenLastCalledWith({
      email: 'lena@test.local',
      password: keys.authSecret,
    })
  }, 30000)
})
