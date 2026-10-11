import { createContext, useContext, useEffect, useRef } from 'react'

export interface UnsavedHandlers {
  save?: () => Promise<boolean>
  discard: () => void
}

export interface UnsavedApi {
  register(id: string, dirty: boolean, handlers: { current: UnsavedHandlers }): void
  unregister(id: string): void
  confirmLeave(go: () => void): void
}

export const UnsavedContext = createContext<UnsavedApi | null>(null)

/** Meldet einen Abschnitt beim Wächter an; ohne Wächter (einzeln gerendert) wirkungslos. */
export function useRegisterUnsaved(id: string, dirty: boolean, handlers: UnsavedHandlers): void {
  const api = useContext(UnsavedContext)
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    api?.register(id, dirty, ref)
  }, [api, id, dirty])
  useEffect(() => {
    if (!api) return
    return () => api.unregister(id)
  }, [api, id])
}

/** Fragt vor dem Verlassen nach, wenn etwas ungespeichert ist; ohne Wächter geht es direkt weiter. */
export function useConfirmLeave(): (go: () => void) => void {
  const api = useContext(UnsavedContext)
  return api ? api.confirmLeave : (go) => go()
}
