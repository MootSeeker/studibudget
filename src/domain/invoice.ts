import { effectsOf, settlementEffect } from './settlement'
import type { Category, Settlement, Transaction } from './types'

export interface InvoiceLine {
  date: string
  /** Notiz der Buchung, sonst der Name der Kategorie. */
  description: string
  /** Anteil der Person: positiv schuldet sie mir, negativ habe ich ihr gegenüber eine Schuld. */
  cents: number
}

export interface Invoice {
  positions: InvoiceLine[]
  /** Erfasste Ausgleichszahlungen als Abzug (negativ, wenn die Person bereits gezahlt hat). */
  deductions: InvoiceLine[]
  /** Summe aus Positionen und Abzügen; entspricht dem Saldo der Person. */
  totalCents: number
}

const byDate = (a: InvoiceLine, b: InvoiceLine) =>
  a.date === b.date ? 0 : a.date < b.date ? -1 : 1

/** Die Rechnung an eine Person aus gemeinsamen Buchungen und Ausgleichszahlungen. Reine Berechnung, ändert nichts. */
export function buildInvoice(
  personId: string,
  txs: Transaction[],
  settlements: Settlement[],
  categories: Pick<Category, 'id' | 'name'>[],
): Invoice {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt'
  const positions: InvoiceLine[] = []
  for (const t of txs) {
    for (const e of effectsOf(t)) {
      if (e.personId === personId)
        positions.push({
          date: t.date,
          description: t.note || catName(t.categoryId),
          cents: e.cents,
        })
    }
  }
  const deductions: InvoiceLine[] = []
  for (const s of settlements) {
    if (s.deleted) continue
    const e = settlementEffect(s)
    if (e.personId !== personId) continue
    deductions.push({
      date: s.date,
      description:
        s.note || (s.direction === 'ich_erhalte' ? 'Zahlung erhalten' : 'Zahlung von dir'),
      cents: e.cents,
    })
  }
  positions.sort(byDate)
  deductions.sort(byDate)
  const totalCents = [...positions, ...deductions].reduce((s, l) => s + l.cents, 0)
  return { positions, deductions, totalCents }
}
