import { db } from '../../data/db'
import type { Settings } from '../../domain/types'
import { saveSettings } from './Sections'

/** Die Backup-Logik (mit der Datei-Prüfung) wird erst geladen, wenn man sie braucht. */
const backupModule = () => import('../../data/backup')

/** Backup erstellen, selbst prüfen und herunterladen; merkt sich das Datum. Wirft bei einem Fehler. */
export async function downloadBackup(settings: Settings): Promise<void> {
  const { exportBackup, backupFileName, parseBackup } = await backupModule()
  const now = new Date()
  const backup = await exportBackup(db, now)
  const json = JSON.stringify(backup, null, 2)
  // Selbstprüfung: Eine Datei, die sich später nicht wieder einspielen liesse, soll gar nicht erst entstehen.
  const check = parseBackup(json)
  if (!check.ok)
    throw new Error(
      `Das Backup wurde nicht erstellt, weil deine Daten eine Unstimmigkeit enthalten. ${check.error}`,
    )
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(now)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  await saveSettings(settings, { lastBackupAt: now.toISOString() })
}
