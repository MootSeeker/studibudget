import { useState, useSyncExternalStore } from 'react'
import { pwa, type PwaStore } from '../lib/pwa'

/** Meldet, wenn eine neue Version der App bereitsteht (unabhängig davon, ob man angemeldet ist). */
export function UpdateBanner({ store = pwa }: { store?: PwaStore }) {
  const available = useSyncExternalStore(store.subscribe, store.updateAvailable)
  const [busy, setBusy] = useState(false)
  if (!available) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-md border border-accent/50 bg-surface px-4 py-3 text-sm shadow-lg"
    >
      <span>Eine neue Version von StudiBudget ist verfügbar.</span>
      <button
        className="rounded-md bg-accent px-3 py-1 text-accent-text disabled:opacity-50"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void store.applyUpdate()
        }}
      >
        Jetzt aktualisieren
      </button>
    </div>
  )
}
