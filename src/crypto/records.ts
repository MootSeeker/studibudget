import { openJson, sealJson } from './box'

export interface PlainRecord {
  table: string
  data: unknown
}

/** Ein Datensatz wird samt Tabellenname verschlüsselt; die Datensatz-ID dient als Echtheitsbindung (AAD). */
export function encryptRecord(dek: CryptoKey, id: string, rec: PlainRecord): Promise<string> {
  return sealJson(dek, rec, id)
}

export function decryptRecord(
  dek: CryptoKey,
  id: string,
  ciphertext: string,
): Promise<PlainRecord> {
  return openJson<PlainRecord>(dek, ciphertext, id)
}
