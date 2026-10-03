import { open, seal } from './box'
import { fromBase32, toB64, toBase32 } from './encoding'

export interface KdfParams {
  v: 1
  iterations: number
}

export const DEFAULT_KDF: KdfParams = { v: 1, iterations: 600_000 }

const enc = new TextEncoder()

async function hkdfKey(master: Uint8Array<ArrayBuffer>, info: string, usage: 'bits' | 'aes') {
  const base = await crypto.subtle.importKey('raw', master, 'HKDF', false, [
    'deriveBits',
    'deriveKey',
  ])
  const params = { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info) }
  if (usage === 'bits') return new Uint8Array(await crypto.subtle.deriveBits(params, base, 256))
  return crypto.subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
}

/** Aus Passwort + E-Mail: das Login-Geheimnis für Supabase und der Schlüssel, der den Datenschlüssel verpackt. */
export async function deriveFromPassword(password: string, email: string, kdf: KdfParams) {
  const pw = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const master = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: enc.encode('studibudget:' + email.trim().toLowerCase()),
        iterations: kdf.iterations,
      },
      pw,
      256,
    ),
  )
  const authSecret = toB64((await hkdfKey(master, 'studibudget-auth', 'bits')) as Uint8Array)
  const kek = (await hkdfKey(master, 'studibudget-enc', 'aes')) as CryptoKey
  return { authSecret, kek }
}

/** 128 Bit Zufall als «ABCD-EFGH-…» (26 Zeichen in 7 Gruppen). */
export function generateRecoveryCode(): { code: string; raw: Uint8Array<ArrayBuffer> } {
  const raw = crypto.getRandomValues(new Uint8Array(16))
  const text = toBase32(raw).slice(0, 26)
  return { code: text.match(/.{1,4}/g)!.join('-'), raw }
}

export function parseRecoveryCode(code: string): Uint8Array<ArrayBuffer> {
  const clean = code.replace(/[\s-]/g, '').toUpperCase()
  if (clean.length !== 26) throw new Error('Der Wiederherstellungsschlüssel hat 26 Zeichen')
  return fromBase32(clean).slice(0, 16)
}

async function recoveryKek(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return (await hkdfKey(raw, 'studibudget-recovery', 'aes')) as CryptoKey
}

export function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

async function wrap(dek: CryptoKey, kek: CryptoKey, aad: string): Promise<string> {
  return seal(kek, new Uint8Array(await crypto.subtle.exportKey('raw', dek)), aad)
}

async function unwrap(sealed: string, kek: CryptoKey, aad: string): Promise<CryptoKey> {
  const raw = await open(kek, sealed, aad)
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

export interface AccountKeys {
  /** Wird als «Passwort» an Supabase Auth geschickt, nie das echte Passwort. */
  authSecret: string
  wrappedDek: string
  wrappedDekRecovery: string
  kdf: KdfParams
  /** Nur einmal anzeigen, nie speichern. */
  recoveryCode: string
  dek: CryptoKey
}

/** Registrierung: neuer Datenschlüssel, einmal mit dem Passwort und einmal mit dem Wiederherstellungsschlüssel verpackt. */
export async function createAccountKeys(
  password: string,
  email: string,
  kdf: KdfParams = DEFAULT_KDF,
): Promise<AccountKeys> {
  const { authSecret, kek } = await deriveFromPassword(password, email, kdf)
  const dek = await generateDek()
  const { code, raw } = generateRecoveryCode()
  return {
    authSecret,
    wrappedDek: await wrap(dek, kek, 'dek'),
    wrappedDekRecovery: await wrap(dek, await recoveryKek(raw), 'dek-recovery'),
    kdf,
    recoveryCode: code,
    dek,
  }
}

/** Anmeldung: Schlüssel ableiten und den Datenschlüssel entpacken. Wirft bei falschem Passwort. */
export async function unlockWithPassword(
  password: string,
  email: string,
  wrappedDek: string,
  kdf: KdfParams,
) {
  const { authSecret, kek } = await deriveFromPassword(password, email, kdf)
  return { authSecret, dek: await unwrap(wrappedDek, kek, 'dek') }
}

export async function unlockWithRecovery(
  code: string,
  wrappedDekRecovery: string,
): Promise<CryptoKey> {
  return unwrap(wrappedDekRecovery, await recoveryKek(parseRecoveryCode(code)), 'dek-recovery')
}

/** Passwort ändern bzw. zurücksetzen: denselben Datenschlüssel mit dem neuen Passwort neu verpacken. */
export async function rewrapForPassword(
  dek: CryptoKey,
  newPassword: string,
  email: string,
  kdf: KdfParams = DEFAULT_KDF,
) {
  const { authSecret, kek } = await deriveFromPassword(newPassword, email, kdf)
  return { authSecret, wrappedDek: await wrap(dek, kek, 'dek'), kdf }
}

/** Neuer Wiederherstellungsschlüssel (der alte wird damit ungültig). */
export async function newRecoveryFor(dek: CryptoKey) {
  const { code, raw } = generateRecoveryCode()
  return {
    recoveryCode: code,
    wrappedDekRecovery: await wrap(dek, await recoveryKek(raw), 'dek-recovery'),
  }
}

/** Datenschlüssel mit einem bereits abgeleiteten KEK entpacken (vermeidet doppeltes PBKDF2). */
export function openDek(wrappedDek: string, kek: CryptoKey): Promise<CryptoKey> {
  return unwrap(wrappedDek, kek, 'dek')
}
