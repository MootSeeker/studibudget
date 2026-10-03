/** Rundet die Achse auf «schöne» Schritte (1, 2, 5 × 10^n). */
export function niceStep(range: number, ticks = 4): number {
  const raw = range / ticks || 1
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}
