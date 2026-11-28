import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { buttonClass } from '../../auth/ui'
import { db } from '../../data/db'
import { useSyncOptional } from '../../sync/SyncProvider'

const changes = (n: number) => (n === 1 ? '1 Änderung ist' : `${n} Änderungen sind`)

/**
 * Abmelden löscht die Daten auf diesem Gerät. Gibt es noch nicht hochgeladene Änderungen, fragt die App vorher
 * und bietet an, zuerst zu synchronisieren (#170).
 */
export function LogoutSection() {
  const auth = useAuth()
  const sync = useSyncOptional()
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function start() {
    setError(null)
    const n = await db.outbox.count()
    if (n === 0) return auth.logout()
    setPending(n)
  }

  async function syncFirst() {
    setBusy(true)
    setError(null)
    try {
      await sync?.flush()
      const left = await db.outbox.count()
      if (left === 0) return await auth.logout()
      setPending(left)
      setError(
        `Hochladen hat nicht geklappt: ${changes(left)} noch ausstehend. Prüfe die Verbindung oder melde dich trotzdem ab.`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {pending === null ? (
        <button className={buttonClass} onClick={() => void start()}>
          Abmelden
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-labelledby="abmelden-titel"
          className="space-y-3 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm"
        >
          <p id="abmelden-titel" className="font-medium">
            {changes(pending)} noch nicht hochgeladen.
          </p>
          <p>Beim Abmelden werden sie mit allen Daten auf diesem Gerät gelöscht.</p>
          {error && <p role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass} disabled={busy} onClick={() => void syncFirst()}>
              Zuerst synchronisieren
            </button>
            <button
              className="rounded-md border border-border px-3 py-2"
              disabled={busy}
              onClick={() => void auth.logout()}
            >
              Trotzdem abmelden
            </button>
            <button
              className="rounded-md border border-border px-3 py-2"
              disabled={busy}
              onClick={() => {
                setPending(null)
                setError(null)
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted">
        Beim Abmelden werden die Daten auf diesem Gerät gelöscht.
      </p>
    </div>
  )
}
