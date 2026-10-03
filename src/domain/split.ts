import type { SharedInfo, Who } from './types'

/** Teilt einen Betrag möglichst gleich; die Summe stimmt immer genau (Rest geht an die ersten). */
export function splitEqual(totalCents: number, n: number): number[] {
  const base = Math.trunc(totalCents / n)
  let rest = totalCents - base * n
  return Array.from({ length: n }, () => {
    if (rest === 0) return base
    const step = rest > 0 ? 1 : -1
    rest -= step
    return base + step
  })
}

/** Teilt nach Prozentanteilen (Summe 100); Rundungsrest geht an die grösste Gewichtung. */
export function splitByPercent(totalCents: number, pcts: number[]): number[] {
  const parts = pcts.map((p) => Math.round((totalCents * p) / 100))
  const diff = totalCents - parts.reduce((a, b) => a + b, 0)
  parts[pcts.indexOf(Math.max(...pcts))] += diff
  return parts
}

/** Gleichmässig geteilte Ausgabe. `participants` enthält 'me' und die beteiligten Personen. */
export function buildSharedEqual(totalCents: number, paidBy: Who, participants: Who[]): SharedInfo {
  const cents = splitEqual(totalCents, participants.length)
  return { paidBy, parts: participants.map((who, i) => ({ who, cents: cents[i] })) }
}

/** Ausgabe mit Partner/in: mein Anteil in Prozent, der Rest geht an die Person. */
export function buildSharedPartner(
  totalCents: number,
  paidBy: Who,
  partnerId: string,
  myPct: number,
): SharedInfo {
  const [mine, theirs] = splitByPercent(totalCents, [myPct, 100 - myPct])
  return {
    paidBy,
    parts: [
      { who: 'me', cents: mine },
      { who: partnerId, cents: theirs },
    ],
  }
}

/** Mein Eigenanteil; ohne Teilung der volle Betrag. */
export function myShare(totalCents: number, shared?: SharedInfo): number {
  if (!shared) return totalCents
  return shared.parts.find((p) => p.who === 'me')?.cents ?? 0
}

/** Teilt nach beliebigen Gewichten (z. B. früheren Anteilen); die Summe stimmt immer genau. */
export function splitByWeights(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) return splitEqual(totalCents, weights.length)
  const raw = weights.map((w) => (totalCents * w) / sum)
  const parts = raw.map(Math.floor)
  let rest = totalCents - parts.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (rest <= 0) break
    parts[i]++
    rest--
  }
  return parts
}

/** Gleiche Aufteilung auf einen neuen Gesamtbetrag übertragen (z. B. wenn eine Vorlage anders ausfällt). */
export function rescaleShared(shared: SharedInfo, newTotalCents: number): SharedInfo {
  const cents = splitByWeights(
    newTotalCents,
    shared.parts.map((p) => p.cents),
  )
  return {
    paidBy: shared.paidBy,
    parts: shared.parts.map((p, i) => ({ who: p.who, cents: cents[i] })),
  }
}
