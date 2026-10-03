/** Gibt es `name` (ohne Beachtung von Gross-/Kleinschreibung und Randleerzeichen) schon in `existing`? */
export function isDuplicateName(name: string, existing: string[]): boolean {
  const clean = name.trim().toLowerCase()
  return clean !== '' && existing.some((e) => e.trim().toLowerCase() === clean)
}

/** Erster Name, der in der Liste mehrfach vorkommt (leere werden ignoriert); sonst null. */
export function firstDuplicate(names: string[]): string | null {
  const seen = new Set<string>()
  for (const n of names) {
    const key = n.trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) return n.trim()
    seen.add(key)
  }
  return null
}
