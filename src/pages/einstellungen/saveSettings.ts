import { store } from '../../data/store'
import type { Settings } from '../../domain/types'

/** Speichert Änderungen an den Einstellungen (wird synchronisiert). */
export function saveSettings(settings: Settings, patch: Partial<Settings>): Promise<void> {
  // Nur die geänderten Felder, angewendet auf den aktuellen Stand (nicht auf den Bildschirmzustand `settings`).
  return store.patch('settings', settings.id, patch)
}
