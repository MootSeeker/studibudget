import { rescaleShared } from './split'
import { addMonths, type MonthKey } from './period'
import type { Area, Category, Template, Transaction } from './types'

const monthNumber = (m: MonthKey) => Number(m.slice(5, 7))

/** Aktive Vorlagen, die in diesem Monat fällig sind und noch nicht gebucht wurden. */
export function openTemplates(
  templates: Template[],
  txs: Transaction[],
  month: MonthKey,
): Template[] {
  const booked = new Set(
    txs
      .filter((t) => !t.deleted && t.templateId && t.templateMonth === month)
      .map((t) => t.templateId),
  )
  return templates.filter(
    (t) =>
      !t.deleted &&
      t.active &&
      t.months.includes(monthNumber(month)) &&
      !t.skipMonths?.includes(month) &&
      !booked.has(t.id),
  )
}

/** `skipMonths` mit zusätzlichen Monaten (ohne Doppelte, sortiert). */
export function withSkipped(current: string[] | undefined, months: string[]): string[] {
  return [...new Set([...(current ?? []), ...months])].sort()
}

/** Buchung aus einer Vorlage; `amountCents` überschreibt den Betrag (die Aufteilung wird mitgerechnet). */
export function templateToDraft(
  template: Template,
  month: MonthKey,
  id: string,
  amountCents: number = template.amountCents,
  note: string = template.note,
): Omit<Transaction, 'updatedAt'> {
  const shared = template.shared ? rescaleShared(template.shared, amountCents) : undefined
  const mine = shared ? (shared.parts.find((p) => p.who === 'me')?.cents ?? 0) : amountCents
  return {
    id,
    deleted: false,
    date: `${month}-01`,
    categoryId: template.categoryId,
    amountCents,
    myAmountCents: mine,
    note,
    ...(shared ? { shared } : {}),
    ...(template.carId ? { carId: template.carId } : {}),
    templateId: template.id,
    templateMonth: month,
  }
}

export type IntervalEvery = 1 | 2 | 3 | 4 | 6 | 12

export const INTERVALS: { every: IntervalEvery; label: string }[] = [
  { every: 1, label: 'Jeden Monat' },
  { every: 2, label: 'Alle 2 Monate' },
  { every: 3, label: 'Alle 3 Monate' },
  { every: 4, label: 'Alle 4 Monate' },
  { every: 6, label: 'Halbjährlich' },
  { every: 12, label: 'Jährlich' },
]

/** Fälligkeitsmonate (1–12) bei «alle n Monate ab Startmonat». */
export function monthsForInterval(every: IntervalEvery, startMonth: number): number[] {
  const out: number[] = []
  for (let m = startMonth; m <= 12; m += every) out.push(m)
  for (let m = startMonth - every; m >= 1; m -= every) out.push(m)
  return out.sort((a, b) => a - b)
}

/** Erkennt ein regelmässiges Intervall; `null` bei einer eigenen Auswahl. */
export function detectInterval(
  months: number[],
): { every: IntervalEvery; startMonth: number } | null {
  const sorted = [...months].sort((a, b) => a - b)
  for (const { every } of INTERVALS) {
    const start = ((sorted[0] - 1) % every) + 1
    const expected = monthsForInterval(every, start)
    if (expected.length === sorted.length && expected.every((m, i) => m === sorted[i]))
      return { every, startMonth: sorted[0] }
  }
  return null
}

export interface ReserveItem {
  templateId: string
  categoryId: string
  perMonthCents: number
  nextMonth: number
}

/**
 * Rückstellung für Ausgaben, die nicht jeden Monat fällig sind: Jahresbetrag geteilt durch 12.
 * Nur ein Hinweis, Saldo und Ampel bleiben unverändert. Bei geteilten Vorlagen zählt der Eigenanteil.
 */
export function reservePlan(
  templates: Template[],
  categories: Category[],
  month: MonthKey,
): { items: ReserveItem[]; totalCents: number } {
  const expense = new Set(categories.filter((c) => c.type === 'ausgabe').map((c) => c.id))
  const now = monthNumber(month)
  const items: ReserveItem[] = []
  for (const t of templates) {
    if (t.deleted || !t.active || t.noReserve || !expense.has(t.categoryId)) continue
    if (t.months.length === 0 || t.months.length >= 12) continue
    const mine = t.shared ? (t.shared.parts.find((p) => p.who === 'me')?.cents ?? 0) : t.amountCents
    const sorted = [...t.months].sort((a, b) => a - b)
    items.push({
      templateId: t.id,
      categoryId: t.categoryId,
      perMonthCents: Math.round((mine * t.months.length) / 12),
      nextMonth: sorted.find((m) => m >= now) ?? sorted[0],
    })
  }
  return { items, totalCents: items.reduce((s, i) => s + i.perMonthCents, 0) }
}

export interface TemplateGroup {
  type: Category['type']
  templates: Template[]
}

/**
 * Vorlagen für die Liste (#181): getrennt nach Ausgaben, Einnahmen und Sparen, darin nach Bereich und Kategorie
 * wie unter Budget › Monatsbudget. Unbekannte Kategorien stehen am Ende der Ausgaben; leere Gruppen entfallen.
 */
export function groupTemplates(
  templates: Template[],
  categories: Category[],
  areas: Area[],
): TemplateGroup[] {
  const areaOrder = new Map(areas.map((a) => [a.id, a.order]))
  const catOf = new Map(categories.map((c) => [c.id, c]))
  const key = (t: Template): [number, number] => {
    const c = catOf.get(t.categoryId)
    if (!c) return [Infinity, Infinity]
    return [areaOrder.get(c.areaId) ?? Infinity, c.order]
  }
  const sorted = [...templates].sort((a, b) => {
    const [aa, ac] = key(a)
    const [ba, bc] = key(b)
    return aa === ba ? (ac === bc ? 0 : ac < bc ? -1 : 1) : aa < ba ? -1 : 1
  })
  const types: Category['type'][] = ['ausgabe', 'einnahme', 'sparen']
  return types
    .map((type) => ({
      type,
      templates: sorted.filter((t) => (catOf.get(t.categoryId)?.type ?? 'ausgabe') === type),
    }))
    .filter((g) => g.templates.length > 0)
}

/** Nächster Monat ab `from` (inklusive), in dem die Vorlage fällig ist; null, wenn pausiert oder ohne Monate. */
export function nextDueMonth(t: Template, from: MonthKey): MonthKey | null {
  if (!t.active || t.months.length === 0) return null
  for (let i = 0; i < 36; i++) {
    const m = addMonths(from, i)
    if (t.months.includes(Number(m.slice(5, 7))) && !t.skipMonths?.includes(m)) return m
  }
  return null
}
