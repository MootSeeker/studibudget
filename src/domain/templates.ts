import { rescaleShared } from './split'
import type { MonthKey } from './period'
import type { Template, Transaction } from './types'

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
    (t) => !t.deleted && t.active && t.months.includes(monthNumber(month)) && !booked.has(t.id),
  )
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
    templateId: template.id,
    templateMonth: month,
  }
}
