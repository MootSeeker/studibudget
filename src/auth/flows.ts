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

async function applyNewPassword(
  sb: SupabaseClient,
  dek: CryptoKey,
  email: string,
  newPassword: string,
): Promise<void> {
  const next = await rewrapForPassword(dek, newPassword, email)
  const { error } = await sb.auth.updateUser({ password: next.authSecret })
  if (error) throw mapError(error)
  await storeKeys(sb, { wrapped_dek: next.wrappedDek, kdf: next.kdf })
}

async function verifyPassword(
  sb: SupabaseClient,
  email: string,
  password: string,
): Promise<CryptoKey> {
  const keys = await fetchKeys(sb)
  const { kek } = await deriveFromPassword(password, email, DEFAULT_KDF)
  try {
    return await openDek(keys.wrapped_dek, kek)
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
  const dek = await verifyPassword(sb, email, oldPassword)
  await applyNewPassword(sb, dek, email, newPassword)
}

/** Erzeugt einen neuen Wiederherstellungsschlüssel; der alte wird ungültig. */
export async function renewRecoveryKey(
  sb: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const dek = await verifyPassword(sb, email, password)
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
