/**
 * Posteingang des KI-Konnektors (#157), Format 1. Nur Web Crypto (globalThis.crypto): läuft im Browser und in Node ab 20 (#158).
 * Chiffretext = base64(0x01 ‖ ephemerer öffentlicher Schlüssel P-256 raw (65 Byte) ‖ IV (12 Byte) ‖ AES-GCM mit Tag)
 * Schlüssel   = HKDF-SHA-256(ECDH(ephemer, Empfänger), salt = ephemer raw ‖ Empfänger raw, info = INBOX_HKDF_INFO)
 * AAD         = Vorschlags-ID in Kleinbuchstaben
 * Klartext    = JSON {"studibudgetVorschlaege":1,"eintraege":[ein Eintrag]} (src/domain/proposals.ts)
 */
import { open, seal } from './box'
import { fromB64, toB64 } from './encoding'

export const INBOX_FORMAT = 1
export const INBOX_HKDF_INFO = 'studibudget-inbox-v1'

const CURVE = { name: 'ECDH', namedCurve: 'P-256' } as const
const RAW_LEN = 65
const IV_LEN = 12
const TAG_LEN = 16
const enc = new TextEncoder()
const dec = new TextDecoder()

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

const privateAad = (connectionId: string) => 'inbox-private:' + connectionId

/** Neues Schlüsselpaar für eine Verbindung; der öffentliche Schlüssel als Base64 (raw, 65 Byte). */
export async function generateInboxKeyPair(): Promise<{
  publicKey: string
  privateKey: CryptoKey
}> {
  const pair = await crypto.subtle.generateKey(CURVE, true, ['deriveBits'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { publicKey: toB64(raw), privateKey: pair.privateKey }
}

/** Privater Schlüssel, mit dem Datenschlüssel verpackt und an die Verbindungs-ID gebunden. */
export async function wrapInboxPrivateKey(
  dek: CryptoKey,
  connectionId: string,
  privateKey: CryptoKey,
): Promise<string> {
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey))
  return seal(dek, pkcs8, privateAad(connectionId))
}

export async function unwrapInboxPrivateKey(
  dek: CryptoKey,
  connectionId: string,
  wrapped: string,
): Promise<CryptoKey> {
  const pkcs8 = await open(dek, wrapped, privateAad(connectionId))
  return crypto.subtle.importKey('pkcs8', pkcs8, CURVE, false, ['deriveBits'])
}

async function aesKey(
  privateKey: CryptoKey,
  peerRaw: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const peer = await crypto.subtle.importKey('raw', peerRaw, CURVE, false, [])
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256)
  const base = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(INBOX_HKDF_INFO) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Verschlüsselt einen Eintrag für den Posteingang (läuft beim MCP-Server, #158). */
export async function sealForInbox(
  publicKey: string,
  proposalId: string,
  plaintext: string,
): Promise<string> {
  const recipientRaw = fromB64(publicKey)
  const eph = await crypto.subtle.generateKey(CURVE, true, ['deriveBits'])
  const ephRaw = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey))
  const key = await aesKey(eph.privateKey, recipientRaw, concat(ephRaw, recipientRaw))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(proposalId.toLowerCase()) },
      key,
      enc.encode(plaintext),
    ),
  )
  return toB64(concat(new Uint8Array([INBOX_FORMAT]), ephRaw, iv, ct))
}

/** Wirft bei fremdem Schlüssel, falscher Vorschlags-ID, verändertem Inhalt oder unbekanntem Format. */
export async function openInboxEntry(
  privateKey: CryptoKey,
  publicKey: string,
  proposalId: string,
  ciphertext: string,
): Promise<string> {
  const all = fromB64(ciphertext)
  if (all[0] !== INBOX_FORMAT || all.length < 1 + RAW_LEN + IV_LEN + TAG_LEN)
    throw new Error('Unbekanntes Format im Posteingang')
  const ephRaw = all.slice(1, 1 + RAW_LEN)
  const iv = all.slice(1 + RAW_LEN, 1 + RAW_LEN + IV_LEN)
  const ct = all.slice(1 + RAW_LEN + IV_LEN)
  const key = await aesKey(privateKey, ephRaw, concat(ephRaw, fromB64(publicKey)))
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(proposalId.toLowerCase()) },
    key,
    ct,
  )
  return dec.decode(pt)
}

/** Token einer Verbindung: «sbi1_» und 32 Zufallsbytes als Base64url (43 Zeichen). */
export function newInboxToken(): string {
  const b64 = toB64(crypto.getRandomValues(new Uint8Array(32)))
  return 'sbi1_' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** SHA-256 des Tokens (UTF-8) als Hex; nur dieser Wert liegt auf dem Server. */
export async function hashInboxToken(token: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(token)))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
}
