import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buttonClass } from '../../auth/ui'
import { UnsavedContext, type UnsavedApi, type UnsavedHandlers } from './useUnsaved'

type Entry = { dirty: boolean; handlers: { current: UnsavedHandlers } }
const secondaryClass = 'min-h-11 rounded-md border border-control px-4 py-2'

function LeaveDialog({
  canSave,
  busy,
  onSave,
  onDiscard,
  onClose,
}: {
  canSave: boolean
  busy: boolean
  onSave(): void
  onDiscard(): void
  onClose(): void
}) {
  const box = useRef<HTMLDivElement>(null)
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
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ungespeichert-titel"
        className="w-full max-w-md space-y-4 rounded-xl bg-surface p-5"
      >
        <h2 id="ungespeichert-titel" className="text-lg font-semibold">
          Ungespeicherte Änderungen
        </h2>
        <p className="text-sm">Einige Änderungen sind noch nicht gespeichert.</p>
        <div className="flex flex-wrap gap-2">
          {canSave && (
            <button type="button" className={buttonClass} disabled={busy} onClick={onSave}>
              Speichern
            </button>
          )}
          <button type="button" className={secondaryClass} disabled={busy} onClick={onDiscard}>
            Verwerfen
          </button>
          <button type="button" className={secondaryClass} disabled={busy} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

/** Wächter für ungespeicherte Änderungen in den Einstellungen (Issue #185). */
export function UnsavedProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, Entry>())
  const [anyDirty, setAnyDirty] = useState(false)
  const [pending, setPending] = useState<{ go: () => void } | null>(null)
  const [busy, setBusy] = useState(false)

  const api = useMemo<UnsavedApi>(() => {
    const refresh = () => setAnyDirty([...entries.current.values()].some((e) => e.dirty))
    return {
      register(id, dirty, handlers) {
        entries.current.set(id, { dirty, handlers })
        refresh()
      },
      unregister(id) {
        entries.current.delete(id)
        refresh()
      },
      confirmLeave(go) {
        if ([...entries.current.values()].some((e) => e.dirty)) setPending({ go })
        else go()
      },
    }
  }, [])

  useEffect(() => {
    if (!anyDirty) return
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#/"]')
      if (!a) return
      const href = a.getAttribute('href') ?? '#/'
      e.preventDefault()
      e.stopPropagation()
      api.confirmLeave(() => {
        window.location.hash = href.slice(1)
      })
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [anyDirty, api])

  const dirtyEntries = () => [...entries.current.values()].filter((e) => e.dirty)

  async function save() {
    if (!pending) return
    setBusy(true)
    for (const e of dirtyEntries()) {
      const ok = await (e.handlers.current.save?.() ?? Promise.resolve(false)).catch(() => false)
      if (!ok) {
        setBusy(false)
        setPending(null)
        return
      }
    }
    setBusy(false)
    setPending(null)
    pending.go()
  }

  function discard() {
    if (!pending) return
    for (const e of dirtyEntries()) e.handlers.current.discard()
    setPending(null)
    pending.go()
  }

  return (
    <UnsavedContext.Provider value={api}>
      {children}
      {pending && (
        <LeaveDialog
          canSave={dirtyEntries().every((e) => e.handlers.current.save !== undefined)}
          busy={busy}
          onSave={() => void save()}
          onDiscard={discard}
          onClose={() => setPending(null)}
        />
      )}
    </UnsavedContext.Provider>
  )
}
