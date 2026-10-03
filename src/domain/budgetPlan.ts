import { budgetForMonth } from './budget'
import type { MonthKey } from './period'
import type { Budget, Category } from './types'

export interface BudgetSummary {
  einnahmen: number
  ausgaben: number
  sparen: number
  /** Einnahmen − Ausgaben − Sparen */
  saldo: number
}

/** Geplante Summen eines Monats; ausgeblendete Kategorien zählen nicht mit. */
export function summarizeBudget(
  categories: Category[],
  budgets: Budget[],
  month: MonthKey,
): BudgetSummary {
  const s = { einnahmen: 0, ausgaben: 0, sparen: 0 }
  for (const c of categories) {
    if (c.deleted || c.hidden) continue
    const amount = budgetForMonth(budgets, c.id, month)
    if (c.type === 'einnahme') s.einnahmen += amount
    else if (c.type === 'ausgabe') s.ausgaben += amount
    else s.sparen += amount
  }
  return { ...s, saldo: s.einnahmen - s.ausgaben - s.sparen }
}

/**
 * Budget «ab Monat» setzen: Gibt es für genau diesen Monat schon einen Eintrag, wird er überschrieben,
 * sonst entsteht ein neuer (frühere Monate behalten ihren Wert).
 */
export function budgetDraftFor(
  budgets: Budget[],
  categoryId: string,
  month: MonthKey,
  amountCents: number,
  newId: () => string,
): Omit<Budget, 'updatedAt'> {
  const same = budgets.find(
    (b) => !b.deleted && b.categoryId === categoryId && b.validFrom === month,
  )
  return { id: same?.id ?? newId(), deleted: false, categoryId, validFrom: month, amountCents }
}

/** Tauscht ein Element mit seinem Nachbarn; gibt nur die Elemente zurück, deren `order` sich ändert. */
export function moveWithin<T extends { id: string; order: number }>(
  items: T[],
  id: string,
  dir: -1 | 1,
): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const i = sorted.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return []
  // Falls mehrere denselben Wert haben, zuerst sauber durchnummerieren.
  const renum = sorted.map((x, k) => ({ ...x, order: k }))
  const a = renum[i]
  const b = renum[j]
  const swapped = [
    { ...a, order: b.order },
    { ...b, order: a.order },
  ]
  return swapped
}
