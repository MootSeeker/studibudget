export interface BackupSettings {
  backupReminderDays: number
  lastBackupAt: string | null
}

export interface BackupStatus {
  /** Soll die App jetzt ans Backup erinnern? */
  due: boolean
  /** Tage seit dem letzten Backup; null, wenn es noch keins gab. */
  daysSince: number | null
}

const DAY = 86_400_000

/**
 * Erinnerung ans Backup: nur wenn sie eingeschaltet ist und es überhaupt Daten gibt, und zwar wenn noch nie gesichert
 * wurde oder das letzte Backup mindestens so viele Tage zurückliegt wie eingestellt.
 */
export function backupStatus(settings: BackupSettings, now: Date, hasData: boolean): BackupStatus {
  const last = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : NaN
  const daysSince = Number.isNaN(last)
    ? null
    : Math.max(0, Math.floor((now.getTime() - last) / DAY))
  const due =
    settings.backupReminderDays > 0 &&
    hasData &&
    (daysSince === null || daysSince >= settings.backupReminderDays)
  return { due, daysSince }
}
