import { useEffect, useRef, useState } from 'react'
import { buttonClass, inputClass } from '../../auth/ui'
import type { Backup } from '../../data/backup'
import { db } from '../../data/db'
import { backupStatus } from '../../domain/backup'
import type { Settings } from '../../domain/types'
import { isStoragePersisted } from '../../lib/storage'
import { saveSettings, Section } from './Sections'

const COUNT_LABEL: [string, string][] = [
  ['transactions', 'Buchungen'],
  ['categories', 'Kategorien'],
  ['budgets', 'Budgets'],
  ['templates', 'Fixkosten-Vorlagen'],
  ['persons', 'Personen'],
  ['settlements', 'Ausgleichszahlungen'],
  ['accounts', 'Konten'],
  ['accountBalances', 'Kontostände'],
  ['goals', 'Sparziele'],
  ['cars', 'Autos'],
]

const REMINDERS: { value: Settings['backupReminderDays']; label: string }[] = [
  { value: 0, label: 'Keine Erinnerung' },
  { value: 7, label: 'Alle 7 Tage' },
  { value: 14, label: 'Alle 14 Tage' },
  { value: 30, label: 'Alle 30 Tage' },
]

/** Die Backup-Logik (mit der Datei-Prüfung) wird erst geladen, wenn man sie braucht. */
const backupModule = () => import('../../data/backup')

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function BackupSection({ settings }: { settings: Settings }) {
  const [pending, setPending] = useState<{
    backup: Backup
    counts: Record<string, number>
    fileName: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void isStoragePersisted().then(setPersisted)
  }, [])

  const status = backupStatus(settings, new Date(), true)

  async function download() {
    setError(null)
    setMessage(null)
    try {
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
      setMessage('Das Backup wurde heruntergeladen.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das Backup konnte nicht erstellt werden.')
    }
  }

  async function pick(file: File | undefined) {
    setError(null)
    setMessage(null)
    setPending(null)
    if (!file) return
    const { parseBackup } = await backupModule()
    const result = parseBackup(await file.text())
    if (!result.ok) return setError(result.error)
    setPending({ backup: result.backup, counts: result.counts, fileName: file.name })
  }

  async function restore() {
    if (!pending) return
    if (
      !window.confirm(
        'Alle aktuellen Daten werden durch das Backup ersetzt, auch auf deinen anderen Geräten. Das lässt sich nicht rückgängig machen. Fortfahren?',
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      const { applyBackup } = await backupModule()
      await applyBackup(db, pending.backup)
      setMessage('Das Backup wurde eingespielt.')
      setPending(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch (e) {
      setError(
        e instanceof Error
          ? `Das Backup konnte nicht eingespielt werden, es wurde nichts verändert (${e.message}).`
          : 'Das Backup konnte nicht eingespielt werden, es wurde nichts verändert.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Backup">
      <p className="text-sm text-muted">
        Deine Daten liegen verschlüsselt in deinem Konto und auf diesem Gerät. Zusätzlich kannst du
        sie als Datei sichern. Die Datei ist <strong>nicht verschlüsselt</strong>: Bewahre sie
        sicher auf und gib sie nicht weiter.
      </p>

      <p className="text-sm" aria-live="polite">
        {settings.lastBackupAt && status.daysSince !== null
          ? `Letztes Backup: ${dateFmt(settings.lastBackupAt)} (${status.daysSince === 0 ? 'heute' : `vor ${status.daysSince} Tag${status.daysSince === 1 ? '' : 'en'}`})`
          : 'Noch kein Backup erstellt.'}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <button className={buttonClass} onClick={download}>
          Backup herunterladen
        </button>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Erinnerung</span>
          <select
            className={inputClass}
            value={settings.backupReminderDays}
            onChange={(e) =>
              void saveSettings(settings, {
                backupReminderDays: Number(e.target.value) as Settings['backupReminderDays'],
              })
            }
          >
            {REMINDERS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Backup einspielen</span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="block w-full text-sm"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
        {pending && (
          <div
            className="space-y-3 rounded-md border border-border bg-bg p-3 text-sm"
            role="region"
            aria-label="Inhalt des Backups"
          >
            <p>
              <strong>{pending.fileName}</strong> vom {dateFmt(pending.backup.exportedAt)}
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {COUNT_LABEL.map(([key, label]) => (
                <li key={key}>
                  {pending.counts[key]} {label}
                </li>
              ))}
            </ul>
            <p className="text-warn">
              Beim Einspielen werden alle aktuellen Daten ersetzt, auch auf deinen anderen Geräten.
            </p>
            <div className="flex gap-2">
              <button className={buttonClass} onClick={restore} disabled={busy}>
                Alle Daten durch dieses Backup ersetzen
              </button>
              <button
                className="rounded-md border border-border px-4 py-2"
                onClick={() => {
                  setPending(null)
                  if (fileInput.current) fileInput.current.value = ''
                }}
                disabled={busy}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      {persisted === false && (
        <p className="text-sm text-muted">
          Dein Browser hat diesen Speicher nicht als dauerhaft zugesichert und könnte ihn bei
          Platzmangel löschen. Dein Konto hält die Daten zusätzlich fest; ein Backup ist trotzdem
          eine gute Absicherung.
        </p>
      )}
    </Section>
  )
}
