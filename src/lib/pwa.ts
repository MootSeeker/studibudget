export type RegisterFn = (onNeedRefresh: () => void) => (reload: boolean) => Promise<void>

/** Der echte Service Worker über das PWA-Plugin (nur in der fertigen App verfügbar). */
const defaultRegister: RegisterFn = (onNeedRefresh) => {
  let update: ((reload?: boolean) => Promise<void>) | null = null
  void import('virtual:pwa-register').then(({ registerSW }) => {
    update = registerSW({ onNeedRefresh })
  })
  return async (reload) => {
    await update?.(reload)
  }
}

/**
 * Hält fest, ob eine neue Version der App bereitsteht. Die neue Version wird nie heimlich aktiv: Man entscheidet selbst,
 * wann neu geladen wird (sonst ginge Ungespeichertes verloren).
 */
export function createPwaStore() {
  let started = false
  let apply: (() => Promise<void>) | null = null
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  return {
    /** Registriert den Service Worker genau einmal. Ohne Browser-Unterstützung oder im Entwicklungsserver passiert nichts. */
    start(
      register: RegisterFn = defaultRegister,
      enabled = import.meta.env.PROD && 'serviceWorker' in navigator,
    ): void {
      if (started || !enabled) return
      started = true
      try {
        const update = register(() => {
          apply = () => update(true)
          emit()
        })
      } catch {
        /* Ohne Service Worker läuft die App normal weiter, nur nicht offline. */
      }
    },
    updateAvailable: () => apply !== null,
    applyUpdate: async () => apply?.(),
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

export type PwaStore = ReturnType<typeof createPwaStore>
export const pwa = createPwaStore()
