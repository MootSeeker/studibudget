import { fromB64, toB64 } from './encoding'

const enc = new TextEncoder()
const dec = new TextDecoder()

/** AES-GCM mit zufälligem IV; Ergebnis: base64(iv ‖ ciphertext). `aad` bindet den Inhalt an z. B. die Datensatz-ID. */
export async function seal(
  key: CryptoKey,
  data: Uint8Array<ArrayBuffer>,
  aad = '',
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
      key,
      data,
    ),
  )
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return toB64(out)
}

/** Wirft, wenn Schlüssel, Inhalt oder `aad` nicht passen (AES-GCM prüft die Echtheit). */
export async function open(
  key: CryptoKey,
  sealed: string,
  aad = '',
): Promise<Uint8Array<ArrayBuffer>> {
  const all = fromB64(sealed)
  const iv = all.slice(0, 12)
  const ct = all.slice(12)
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, ct),
  )
}

export async function sealJson(key: CryptoKey, value: unknown, aad = ''): Promise<string> {
  return seal(key, enc.encode(JSON.stringify(value)), aad)
}

export async function openJson<T>(key: CryptoKey, sealed: string, aad = ''): Promise<T> {
  return JSON.parse(dec.decode(await open(key, sealed, aad))) as T
}
