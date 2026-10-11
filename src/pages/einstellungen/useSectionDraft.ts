import { useEffect, useRef, useState } from 'react'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export interface SectionDraft<T> {
  draft: T
  setDraft(next: T): void
  dirty: boolean
  stale: boolean
  reset(): void
  adoptSaved(): void
  markSaved(value: T): void
}

/** Entwurf neben dem gespeicherten Stand (Issue #184, #185). */
export function useSectionDraft<T>(saved: T): SectionDraft<T> {
  const [state, setState] = useState({ draft: saved, base: saved, stale: false })
  const savedRef = useRef(saved)
  savedRef.current = saved
  const key = JSON.stringify(saved)

  useEffect(() => {
    const now = savedRef.current
    setState((s) => {
      if (same(now, s.base)) return s
      if (same(s.draft, s.base)) return { draft: now, base: now, stale: false }
      return s.stale ? s : { ...s, stale: true }
    })
  }, [key])

  const adopt = () => {
    const now = savedRef.current
    setState({ draft: now, base: now, stale: false })
  }

  return {
    draft: state.draft,
    dirty: !same(state.draft, state.base),
    stale: state.stale,
    setDraft(next) {
      setState((s) => {
        if (!same(next, s.base)) return { ...s, draft: next }
        if (s.stale) return { draft: savedRef.current, base: savedRef.current, stale: false }
        return { draft: next, base: s.base, stale: false }
      })
    },
    reset: adopt,
    adoptSaved: adopt,
    markSaved(value) {
      setState({ draft: value, base: value, stale: false })
    },
  }
}
