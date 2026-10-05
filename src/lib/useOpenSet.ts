import { useState } from 'react'

const read = (key: string): string[] | null => {
  try {
    const raw = localStorage.getItem(key)
    const v = raw === null ? null : JSON.parse(raw)
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null
  } catch {
    return null
  }
}

/**
 * Welche Abschnitte offen sind, gemerkt auf diesem Gerät. Ohne gespeicherten Stand (oder ohne Speicher) gilt
 * `defaultOpen`. Alle Zugriffe auf den Speicher sind abgesichert: Ohne ihn funktioniert alles, nur ohne Gedächtnis.
 */
export function useOpenSet(
  storageKey: string,
  allIds: string[],
  defaultOpen: (id: string) => boolean = () => false,
) {
  const [saved, setSaved] = useState<Set<string> | null>(() => {
    const v = read(storageKey)
    return v ? new Set(v) : null
  })

  const isOpen = (id: string) => (saved ? saved.has(id) : defaultOpen(id))

  const store = (next: Set<string>) => {
    setSaved(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]))
    } catch {
      /* Speicher nicht verfügbar */
    }
  }

  return {
    isOpen,
    toggle: (id: string) =>
      store(new Set(allIds.filter((x) => (x === id ? !isOpen(x) : isOpen(x))))),
    setAll: (open: boolean) => store(new Set(open ? allIds : [])),
  }
}
