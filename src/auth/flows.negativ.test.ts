// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { createAccountKeys, deriveFromPassword, DEFAULT_KDF } from '../crypto/keys'
import { fakeSupabase, USER } from '../test/fakeSupabase'
import {
  AuthError,
  changePassword,
  deleteAccount,
  login,
  renewRecoveryKey,
  requestPasswordReset,
  resetWithRecovery,
} from './flows'

const PW = 'Mein-langes-Passwort-1'
const NEW_PW = 'Ganz-neues-Passwort-2'
let keyRow: { wrapped_dek: string; wrapped_dek_recovery: string; kdf: unknown }
let recoveryCode: string

beforeAll(async () => {
  const k = await createAccountKeys(PW, USER.email)
  keyRow = { wrapped_dek: k.wrappedDek, wrapped_dek_recovery: k.wrappedDekRecovery, kdf: k.kdf }
  recoveryCode = k.recoveryCode
})

const code = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: AuthError) => e.code,
  )

describe('Anmeldung: Fehlerfälle', { tags: ['negativ'] }, () => {
  it.each([
    ['Invalid login credentials', undefined, 'invalid'],
    ['Email not confirmed', undefined, 'unconfirmed'],
    ['TypeError: Failed to fetch', undefined, 'network'],
    ['x', 0, 'network'],
  ])('Serverantwort «%s» (Status %s) → %s', async (message, status, expected) => {
    const f = fakeSupabase({ keys: keyRow })
    f.state.signInError = { message, status }
    expect(await code(login(f.client, USER.email, PW))).toBe(expected)
    expect(f.from).not.toHaveBeenCalled()
  })

  it('fehlende Schlüssel-Zeile: Fehler «keys» und Abmeldung', async () => {
    const f = fakeSupabase({ keys: null })
    expect(await code(login(f.client, USER.email, PW))).toBe('keys')
    expect(f.auth.signOut).toHaveBeenCalled()
  })
  it('beschädigter verpackter Schlüssel: Fehler «keys» und Abmeldung', async () => {
    const f = fakeSupabase({ keys: { ...keyRow, wrapped_dek: 'kaputt' } })
    expect(await code(login(f.client, USER.email, PW))).toBe('keys')
    expect(f.auth.signOut).toHaveBeenCalled()
  })
  it('falsches Passwort bei richtigem Server-Login (z. B. veraltete Schlüssel): Fehler «keys»', async () => {
    const f = fakeSupabase({ keys: keyRow })
    expect(await code(login(f.client, USER.email, 'Ein-anderes-Passwort-9'))).toBe('keys')
  })
  it('ein manipulierter Aufwand (kdf) auf dem Server wird ignoriert: es gilt immer der eingebaute Standard', async () => {
    const f = fakeSupabase({ keys: { ...keyRow, kdf: { v: 1, iterations: 1 } } })
    const { dek } = await login(f.client, USER.email, PW)
    expect(dek).toBeDefined()
    const expected = (await deriveFromPassword(PW, USER.email, DEFAULT_KDF)).authSecret
    expect(f.auth.signInWithPassword).toHaveBeenCalledWith({
      email: USER.email,
      password: expected,
    })
  })
})

describe('Konto-Abläufe: Fehlerfälle', { tags: ['negativ'] }, () => {
  it('ohne Sitzung kann der Wiederherstellungsschlüssel nicht erneuert werden', async () => {
    const f = fakeSupabase({ keys: keyRow, session: false })
    expect(await code(renewRecoveryKey(f.client, USER.email, PW))).toBe('session')
    expect(f.keysUpdate).not.toHaveBeenCalled()
  })
  it('das Speichern der Schlüssel wird genau dreimal versucht, dann gibt es einen Fehler', async () => {
    const f = fakeSupabase({ keys: keyRow })
    f.state.keysUpdateError = { message: 'Serverfehler' }
    expect(await code(renewRecoveryKey(f.client, USER.email, PW))).toBe('other')
    expect(f.keysUpdate).toHaveBeenCalledTimes(3)
  })
  it('Wiederherstellung mit falsch geformtem Schlüssel: «invalid», kein Absturz', async () => {
    const f = fakeSupabase({ keys: keyRow })
    expect(await code(resetWithRecovery(f.client, USER.email, 'zu-kurz', NEW_PW))).toBe('invalid')
    expect(f.auth.updateUser).not.toHaveBeenCalled()
  })
  it('Wiederherstellung mit zu schwachem neuem Passwort wird vor dem Server abgelehnt', async () => {
    const f = fakeSupabase({ keys: keyRow })
    expect(await code(resetWithRecovery(f.client, USER.email, recoveryCode, 'kurz'))).toBe('weak')
    expect(f.from).not.toHaveBeenCalled()
  })
  it('Konto löschen mit falschem Passwort ruft den Server nicht auf', async () => {
    const f = fakeSupabase({ keys: keyRow })
    expect(await code(deleteAccount(f.client, USER.email, 'Falsches-Passwort-1'))).toBe('invalid')
    expect(f.rpc).not.toHaveBeenCalled()
    expect(f.auth.signOut).not.toHaveBeenCalled()
  })
  it('scheitert das Löschen auf dem Server, wird nicht abgemeldet', async () => {
    const f = fakeSupabase({ keys: keyRow })
    f.state.rpcError = { message: 'Failed to fetch' }
    expect(await code(deleteAccount(f.client, USER.email, PW))).toBe('network')
    expect(f.auth.signOut).not.toHaveBeenCalled()
  })
  it('Passwort-Reset: Serverfehler werden verständlich gemeldet', async () => {
    const f = fakeSupabase()
    f.auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { message: 'email rate limit exceeded' },
    })
    const e = await requestPasswordReset(f.client, 'a@b.ch', 'http://x/').catch((x) => x)
    expect(e.message).toContain('Zu viele Versuche')
  })
  it('eine leere Fehlermeldung wird zu «Unbekannter Fehler.»', async () => {
    const f = fakeSupabase()
    f.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { message: '' } })
    const e = await requestPasswordReset(f.client, 'a@b.ch', 'http://x/').catch((x) => x)
    expect(e.message).toBe('Unbekannter Fehler.')
  })
})

describe('Passwort ändern ist nicht halb erfolgreich', { tags: ['negativ'] }, () => {
  it(
    'scheitert das Speichern der Schlüssel, wird das alte Auth-Passwort wiederhergestellt (Regression #47)',
    { tags: ['regression'] },
    async () => {
      const f = fakeSupabase({ keys: keyRow })
      f.state.keysUpdateError = { message: 'Serverfehler' }
      await expect(changePassword(f.client, USER.email, PW, NEW_PW)).rejects.toBeInstanceOf(
        AuthError,
      )
      const oldSecret = (await deriveFromPassword(PW, USER.email, DEFAULT_KDF)).authSecret
      const newSecret = (await deriveFromPassword(NEW_PW, USER.email, DEFAULT_KDF)).authSecret
      expect(f.auth.updateUser.mock.calls).toEqual([
        [{ password: newSecret }],
        [{ password: oldSecret }],
      ])
    },
  )
  it('scheitert schon das Setzen des neuen Passworts, bleibt alles beim Alten', async () => {
    const f = fakeSupabase({ keys: keyRow })
    f.state.updateUserError = { message: 'Failed to fetch' }
    expect(await code(changePassword(f.client, USER.email, PW, NEW_PW))).toBe('network')
    expect(f.auth.updateUser).toHaveBeenCalledTimes(1)
    expect(f.keysUpdate).not.toHaveBeenCalled()
  })
  it(
    'beim Zurücksetzen mit Wiederherstellungsschlüssel erklärt die Meldung, wie es weitergeht (Regression #47)',
    { tags: ['regression'] },
    async () => {
      const f = fakeSupabase({ keys: keyRow })
      f.state.keysUpdateError = { message: 'Serverfehler' }
      const e = await resetWithRecovery(f.client, USER.email, recoveryCode, NEW_PW).catch((x) => x)
      expect(e).toBeInstanceOf(AuthError)
      expect(e.message).toMatch(/Passwort vergessen/)
    },
  )
})
