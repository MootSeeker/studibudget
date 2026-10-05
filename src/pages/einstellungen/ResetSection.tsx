import { useEffect, useRef, useState } from 'react'
import { buttonClass } from '../../auth/ui'
import { db } from '../../data/db'
import { createResetOps } from '../../data/resetOps'
import { store } from '../../data/store'
import {
  RESET_KINDS,
  effectiveSelection,
  planReset,
  type ResetData,
  type ResetKind,
} from '../../domain/reset'
import type { Settings } from '../../domain/types'
import { downloadBackup } from './backupDownload'
import { Section } from './Sections'

// Der gemeinsame Store: nur seine Änderungen stossen den Sync an.
const ops = createResetOps(db, store)
const secondaryClass = 'min-h-11 rounded-md border border-control px-4 py-2'
const entries = (n: number) => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`

function ResetDialog({
  settings,
  onClose,
  onDone,
}: {
  settings: Settings
  onClose(): void
  onDone(message: string): void
}) {
  const [data, setData] = useState<ResetData | null>(null)
  const [chosen, setChosen] = useState<Set<ResetKind>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void ops.load().then(setData)
  }, [])

  // Fokus in den Dialog (einmal beim Öffnen), Esc schliesst, Tab bleibt im Dialog.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button, input')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab' || !box.current) return
      const items = [
        ...box.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'),
      ]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const plan = data ? planReset(data, chosen) : null
  const forced = effectiveSelection(chosen)
  const available = (kind: ResetKind) => (data ? data[kind].filter((r) => !r.deleted).length : 0)

  function toggle(kind: ResetKind, on: boolean) {
    const next = new Set(chosen)
    if (on) next.add(kind)
    else next.delete(kind)
    setChosen(next)
  }

  async function backup() {
    setError(null)
    setBackupMessage(null)
    try {
      await downloadBackup(settings)
      setBackupMessage('Das Backup wurde heruntergeladen.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das Backup konnte nicht erstellt werden.')
    }
  }

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const done = await ops.reset(chosen)
      onDone(`${entries(done.total)} gelöscht.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das Zurücksetzen hat nicht geklappt.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-titel"
        className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-surface p-5"
      >
        <h2 id="reset-titel" className="text-lg font-semibold">
          Daten zurücksetzen
        </h2>

        <div className="space-y-2 rounded-md border border-border bg-bg p-3 text-sm">
          <p>
            Gelöschte Daten lassen sich nicht wiederherstellen, auch nicht auf deinen anderen
            Geräten. Sichere sie vorher als Datei, falls du sie noch brauchst.
          </p>
          <button type="button" className={secondaryClass} onClick={() => void backup()}>
            Backup herunterladen
          </button>
          {backupMessage && (
            <p role="status" className="text-ok">
              {backupMessage}
            </p>
          )}
        </div>

        {!data ? (
          <p className="text-sm text-muted">Lädt …</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="mb-1 font-medium">Was soll gelöscht werden?</legend>
            {RESET_KINDS.map(({ kind, label }) => {
              const pulled = kind === 'accountBalances' && chosen.has('accounts')
              return (
                <label key={kind} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={forced.has(kind)}
                    disabled={pulled}
                    onChange={(e) => toggle(kind, e.target.checked)}
                  />
                  <span>
                    {label} ({available(kind)})
                    {pulled && <span className="text-muted"> · mit den Konten</span>}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        {plan && (
          <div className="space-y-1 text-sm" aria-live="polite">
            {plan.detachedFromTemplates > 0 && (
              <p className="text-muted">
                {plan.detachedFromTemplates} Buchungen aus Vorlagen bleiben als normale Buchungen.
              </p>
            )}
            {plan.detachedFromGoals > 0 && (
              <p className="text-muted">
                {plan.detachedFromGoals} Sparbuchungen bleiben als normale Sparbuchungen ohne
                Sparziel.
              </p>
            )}
            <p>
              {plan.total === 0
                ? 'Wähle aus, was gelöscht werden soll.'
                : `Es werden ${entries(plan.total)} gelöscht.`}{' '}
              Konto, Kategorien, Personen, Autos und Einstellungen bleiben.
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={busy || !plan || plan.total === 0}
            onClick={() => void run()}
          >
            {plan && plan.total > 0 ? `${entries(plan.total)} löschen` : 'Löschen'}
          </button>
          <button type="button" className={secondaryClass} onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

/** Neu anfangen, ohne das Konto zu löschen (Issue #30). */
export function ResetSection({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    opener.current?.focus()
  }

  return (
    <Section title="Daten zurücksetzen">
      <p className="text-sm text-muted">
        Lösche Budget, Buchungen, Vorlagen, Ausgleichszahlungen, Konten oder Sparziele, um neu
        anzufangen. Konto, Kategorien und Einstellungen bleiben erhalten.
      </p>
      <button
        ref={opener}
        type="button"
        className={secondaryClass}
        onClick={() => {
          setMessage(null)
          setOpen(true)
        }}
      >
        Zurücksetzen …
      </button>
      {message && (
        <p role="status" className="text-sm text-ok">
          {message}
        </p>
      )}
      {open && (
        <ResetDialog
          settings={settings}
          onClose={close}
          onDone={(m) => {
            close()
            setMessage(m)
          }}
        />
      )}
    </Section>
  )
}
