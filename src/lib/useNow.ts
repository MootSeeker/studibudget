import { useEffect, useState } from 'react'

/** Die aktuelle Zeit für die Anzeige, einmal pro Minute erneuert (statt `new Date()` bei jedem Zeichnen). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
