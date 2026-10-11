import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createAccountKeys, type AccountKeys } from '../crypto/keys'
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

  let keys: AccountKeys
  beforeAll(async () => {
    keys = await createAccountKeys('Richtiges-Passwort-1', 'lena@test.local')
  }, 30000)
  const client = (updateUser: ReturnType<typeof vi.fn>) =>
    ({
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
    }) as unknown as SupabaseClient

  it('AK-3: scheitert auch die Rücknahme, nennt die Meldung den Wiederherstellungsschlüssel', async () => {
    const mitFehler = vi
      .fn()
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: {}, error: { message: 'Keine Verbindung' } })
    const mitAusnahme = vi
      .fn()
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockRejectedValueOnce(new Error('offline'))
    for (const updateUser of [mitFehler, mitAusnahme]) {
      const err = await changeEmail(
        client(updateUser),
        'lena@test.local',
        'Richtiges-Passwort-1',
        'neu@test.local',
      ).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).code).toBe('keys')
      expect((err as AuthError).message).toContain('Wiederherstellungsschlüssel')
      expect(updateUser).toHaveBeenCalledTimes(2)
    }
  }, 60000)

  it('AK-3: vergebene Adresse wird am Fehlercode erkannt, der Text nur ohne Code', async () => {
    const fehlerMit = async (error: { code?: string; status?: number; message: string }) => {
      const updateUser = vi.fn().mockResolvedValue({ data: {}, error })
      return changeEmail(
        client(updateUser),
        'lena@test.local',
        'Richtiges-Passwort-1',
        'neu@test.local',
      ).catch((e: unknown) => (e as AuthError).message)
    }
    expect(await fehlerMit({ code: 'email_exists', status: 422, message: 'egal' })).toBe(
      'Diese Adresse ist schon vergeben.',
    )
    expect(
      await fehlerMit({
        message: 'A user with this email address has already been registered',
        status: 422,
      }),
    ).toBe('Diese Adresse ist schon vergeben.')
    expect(
      await fehlerMit({
        code: 'validation_failed',
        status: 422,
        message: 'Unable to validate email address: invalid format',
      }),
    ).toBe('Unable to validate email address: invalid format')
  }, 60000)
})
