import { useState } from 'react'
import { Link } from 'react-router'
import { useAllTransactions, useSettings } from '../data/hooks'
import { backupStatus } from '../domain/backup'
import { useNow } from '../lib/useNow'

/** Hinweis oben auf der Seite, wenn das Backup überfällig ist. Lässt sich für diese Sitzung wegklicken. */
export function BackupReminder() {
  const settings = useSettings()
  const txs = useAllTransactions()
  const [hidden, setHidden] = useState(false)
  const now = useNow()
  if (!settings || hidden) return null
  const status = backupStatus(settings, now, txs.length > 0)
  if (!status.due) return null
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warn/50 bg-warn/10 px-4 py-3 text-sm"
    >
      <span>
        {status.daysSince === null
          ? 'Du hast noch kein Backup erstellt.'
          : `Dein letztes Backup ist ${status.daysSince} Tage alt.`}{' '}
        Sichere deine Daten als Datei.
      </span>
      <span className="flex items-center gap-3">
        <Link to="/einstellungen" className="rounded-md bg-accent px-3 py-1 text-accent-text">
          Zum Backup
        </Link>
        <button className="underline" onClick={() => setHidden(true)}>
          Später
        </button>
      </span>
    </div>
  )
}
