/** Bittet den Browser, die Daten dauerhaft zu speichern (sonst darf er sie bei Platzmangel oder Inaktivität löschen). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

/** Ist der Speicher als dauerhaft zugesichert? null = unbekannt (Browser kann es nicht sagen). */
export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}
