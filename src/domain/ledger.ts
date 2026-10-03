import { monthOf, type MonthKey } from './period'
import type { Area, Category, Transaction } from './types'

export interface CategoryGroup {
  category: Category
  /** Summe meiner Anteile (Entnahmen aus Sparzielen zählen negativ). */
  total: number
  txs: Transaction[]
}

export interface AreaGroup {
  area: Area
  total: number
  categories: CategoryGroup[]
}

const signed = (t: Transaction) =>
  t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents

/** Buchungen eines Monats nach Bereich › Kategorie gruppiert, neueste zuerst; leere Gruppen entfallen. */
export function groupMonth(
  txs: Transaction[],
  categories: Category[],
  areas: Area[],
  month: MonthKey,
): AreaGroup[] {
  const catById = new Map(categories.map((c) => [c.id, c]))
  const byCat = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (t.deleted || monthOf(t.date) !== month || !catById.has(t.categoryId)) continue
    byCat.set(t.categoryId, [...(byCat.get(t.categoryId) ?? []), t])
  }
  const result: AreaGroup[] = []
  for (const area of [...areas].sort((a, b) => a.order - b.order)) {
    const groups: CategoryGroup[] = categories
      .filter((c) => c.areaId === area.id && byCat.has(c.id))
      .sort((a, b) => a.order - b.order)
      .map((category) => {
        const list = byCat
          .get(category.id)!
          .sort((a, b) =>
            a.date === b.date ? (a.updatedAt < b.updatedAt ? 1 : -1) : a.date < b.date ? 1 : -1,
          )
        return { category, total: list.reduce((s, t) => s + signed(t), 0), txs: list }
      })
    if (groups.length > 0)
      result.push({ area, total: groups.reduce((s, g) => s + g.total, 0), categories: groups })
  }
  return result
}
