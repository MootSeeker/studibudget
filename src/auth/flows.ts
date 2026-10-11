import type { AuthError as SbAuthError, SupabaseClient, User } from '@supabase/supabase-js'
import {
  DEFAULT_KDF,
  createAccountKeys,
  deriveFromPassword,
  newRecoveryFor,
  openDek,
  rewrapForPassword,
  unlockWithRecovery,
  type KdfParams,
} from '../crypto/keys'

export type AuthErrorCode =
  'invalid' | 'unconfirmed' | 'weak' | 'keys' | 'network' | 'session' | 'other'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export const MIN_PASSWORD_LENGTH = 12

export function checkPassword(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`
    : null
}

function mapError(e: SbAuthError | { message: string; status?: number }): AuthError {
  const msg = e.message ?? ''
  if (/invalid login credentials/i.test(msg))
    return new AuthError('invalid', 'E-Mail oder Passwort stimmt nicht.')
  if (/not confirmed/i.test(msg))
    return new AuthError('unconfirmed', 'Bitte bestätige zuerst deine E-Mail-Adresse.')
  if (/fetch|network|failed to/i.test(msg) || e.status === 0)
    return new AuthError('network', 'Keine Verbindung zum Server.')
  if (/signups? (are )?(not allowed|disabled)|signup.?disabled/i.test(msg))
    return new AuthError('other', 'Die Registrierung ist im Moment geschlossen.')
  if (/rate limit|too many/i.test(msg))
    return new AuthError('other', 'Zu viele Versuche. Bitte warte kurz.')
  return new AuthError('other', msg || 'Unbekannter Fehler.')
}

interface KeyRow {
  wrapped_dek: string
  wrapped_dek_recovery: string
  kdf: KdfParams
}

async function currentUserId(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getSession()
  if (!data.session) throw new AuthError('session', 'Du bist nicht angemeldet.')
  return data.session.user.id
}

async function fetchKeys(sb: SupabaseClient): Promise<KeyRow> {
  const { data, error } = await sb
    .from('user_keys')
    .select('wrapped_dek, wrapped_dek_recovery, kdf')
    .maybeSingle()
  if (error) throw mapError(error)
  if (!data)
    throw new AuthError(
      'keys',
      'Zu diesem Konto fehlen die Schlüssel. Bitte lege ein neues Konto an.',
    )
  return data as KeyRow
}

async function storeKeys(sb: SupabaseClient, patch: Partial<KeyRow>): Promise<void> {
  const userId = await currentUserId(sb)
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await sb
      .from('user_keys')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (!error) return
    lastError = error
  }
  throw mapError(lastError as SbAuthError)
}

/** Neues Konto. Der Datenschlüssel entsteht im Browser; zurück kommt der einmal anzuzeigende Wiederherstellungsschlüssel. */
export async function register(
  sb: SupabaseClient,
  email: string,
  password: string,
  redirectTo: string,
): Promise<{ recoveryCode: string }> {
  const weak = checkPassword(password)
  if (weak) throw new AuthError('weak', weak)
  const keys = await createAccountKeys(password, email)
  const { error } = await sb.auth.signUp({
    email: email.trim(),
    password: keys.authSecret,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        wrapped_dek: keys.wrappedDek,
        wrapped_dek_recovery: keys.wrappedDekRecovery,
        kdf: keys.kdf,
      },
    },
  })
  if (error) throw mapError(error)
  return { recoveryCode: keys.recoveryCode }
}

export async function login(
  sb: SupabaseClient,
  email: string,
  password: string,
): Promise<{ dek: CryptoKey; user: User }> {
  const { authSecret, kek } = await deriveFromPassword(password, email, DEFAULT_KDF)
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password: authSecret,
  })
  if (error) throw mapError(error)
  try {
    const keys = await fetchKeys(sb)
    return { dek: await openDek(keys.wrapped_dek, kek), user: data.user }
  } catch (e) {
    await sb.auth.signOut()
    if (e instanceof AuthError) throw e
    throw new AuthError(
      'keys',
      'Die Schlüssel passen nicht zum Passwort. Bitte nutze den Wiederherstellungsschlüssel.',
    )
  }
}

export async function requestPasswordReset(
  sb: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<void> {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) throw mapError(error)
}

/** Passwort vergessen: mit Wiederherstellungsschlüssel (Sitzung kommt aus dem Link in der Reset-Mail). */
export async function resetWithRecovery(
  sb: SupabaseClient,
  email: string,
  recoveryCode: string,
  newPassword: string,
): Promise<CryptoKey> {
  const weak = checkPassword(newPassword)
  if (weak) throw new AuthError('weak', weak)
  const keys = await fetchKeys(sb)
  let dek: CryptoKey
  try {
    dek = await unlockWithRecovery(recoveryCode, keys.wrapped_dek_recovery)
  } catch {
    throw new AuthError('invalid', 'Der Wiederherstellungsschlüssel stimmt nicht.')
  }
  await applyNewPassword(sb, dek, email, newPassword)
  return dek
}

/**
 * Zwei Schritte, die nicht gemeinsam gelingen müssen: erst das Auth-Passwort, dann die neu verpackten Schlüssel. Scheitert
 * der zweite, passt der Server nicht mehr zu den Schlüsseln. Mit `previousAuthSecret` (Passwort ändern) wird der erste
 * Schritt zurückgenommen; beim Zurücksetzen gibt es kein altes Passwort, dort bleibt nur der Hinweis auf «Passwort vergessen».
 */
async function applyNewPassword(
  sb: SupabaseClient,
  dek: CryptoKey,
  email: string,
  newPassword: string,
  previousAuthSecret?: string,
): Promise<void> {
  const next = await rewrapForPassword(dek, newPassword, email)
  const { error } = await sb.auth.updateUser({ password: next.authSecret })
  if (error) throw mapError(error)
  try {
    await storeKeys(sb, { wrapped_dek: next.wrappedDek, kdf: next.kdf })
  } catch (e) {
    if (previousAuthSecret) {
      await sb.auth.updateUser({ password: previousAuthSecret }).catch(() => undefined)
      throw e
    }
    throw new AuthError(
      'keys',
      'Das neue Passwort wurde gesetzt, aber die Schlüssel konnten nicht gespeichert werden. Bitte wähle auf der Anmeldeseite «Passwort vergessen» und gib deinen Wiederherstellungsschlüssel ein.',
    )
  }
}

async function verifyPassword(
  sb: SupabaseClient,
  email: string,
  password: string,
): Promise<{ dek: CryptoKey; authSecret: string }> {
  const keys = await fetchKeys(sb)
  const { kek, authSecret } = await deriveFromPassword(password, email, DEFAULT_KDF)
  try {
    return { dek: await openDek(keys.wrapped_dek, kek), authSecret }
  } catch {
    throw new AuthError('invalid', 'Das Passwort stimmt nicht.')
  }
}

export async function changePassword(
  sb: SupabaseClient,
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const weak = checkPassword(newPassword)
  if (weak) throw new AuthError('weak', weak)
  const { dek, authSecret } = await verifyPassword(sb, email, oldPassword)
  await applyNewPassword(sb, dek, email, newPassword, authSecret)
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_ROLLBACK_FAILED =
  'Die Adresse wurde nicht geändert, und der alte Stand liess sich nicht wiederherstellen. Melde dich ab und wähle auf der Anmeldeseite «Passwort vergessen». Mit deinem Wiederherstellungsschlüssel kommst du wieder an deine Daten.'

/**
 * E-Mail-Adresse ändern (Issue #188). Der Salt des Schlüssels enthält die Adresse: Auth-Passwort und verpackter
 * Datenschlüssel werden deshalb auf die neue Adresse umgestellt, bevor der Server die Änderung annimmt. Der
 * Wiederherstellungsschlüssel bleibt gleich. Keine Migration nötig.
 */
export async function changeEmail(
  sb: SupabaseClient,
  currentEmail: string,
  password: string,
  newEmail: string,
): Promise<string> {
  const next = newEmail.trim().toLowerCase()
  if (!EMAIL_FORMAT.test(next))
    throw new AuthError('invalid', 'Bitte gib eine gültige E-Mail-Adresse ein.')
  if (next === currentEmail.trim().toLowerCase())
    throw new AuthError('invalid', 'Das ist bereits deine Adresse.')
  const { dek, authSecret } = await verifyPassword(sb, currentEmail, password)
  const rewrapped = await rewrapForPassword(dek, password, next)
  const { error } = await sb.auth.updateUser({ email: next, password: rewrapped.authSecret })
  if (error) {
    const code = (error as { code?: string }).code
    if (
      code === 'email_exists' ||
      (code === undefined && /already|registered|exists|taken/i.test(error.message))
    )
      throw new AuthError('other', 'Diese Adresse ist schon vergeben.')
    throw mapError(error)
  }
  try {
    await storeKeys(sb, { wrapped_dek: rewrapped.wrappedDek, kdf: rewrapped.kdf })
  } catch (e) {
    const failed = await sb.auth
      .updateUser({ email: currentEmail.trim().toLowerCase(), password: authSecret })
      .then(
        (r) => r.error !== null,
        () => true,
      )
    if (failed) throw new AuthError('keys', EMAIL_ROLLBACK_FAILED)
    throw e
  }
  return next
}

/** Erzeugt einen neuen Wiederherstellungsschlüssel; der alte wird ungültig. */
export async function renewRecoveryKey(
  sb: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { dek } = await verifyPassword(sb, email, password)
  const next = await newRecoveryFor(dek)
  await storeKeys(sb, { wrapped_dek_recovery: next.wrappedDekRecovery })
  return next.recoveryCode
}

/** Konto samt allen Daten auf dem Server löschen. */
export async function deleteAccount(
  sb: SupabaseClient,
  email: string,
  password: string,
): Promise<void> {
  await verifyPassword(sb, email, password)
  const { error } = await sb.rpc('delete_account')
  if (error) throw mapError(error)
  await sb.auth.signOut({ scope: 'local' })
}

/** Zurücksetzen ohne Wiederherstellungsschlüssel: löscht das Konto (alle Daten sind dann unwiederbringlich weg). */
export async function deleteAccountWithoutKey(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.rpc('delete_account')
  if (error) throw mapError(error)
  await sb.auth.signOut({ scope: 'local' })
}

export async function logout(sb: SupabaseClient): Promise<void> {
  await sb.auth.signOut({ scope: 'local' })
}
