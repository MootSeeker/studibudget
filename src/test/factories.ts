import type { Budget, Category, Transaction } from '../domain/types'

/** Gemeinsame Felder jedes Datensatzes; feste Werte, damit Tests reproduzierbar bleiben. */
export const base = { updatedAt: '2026-01-01T00:00:00Z', deleted: false }

export const tx = (
  p: Partial<Transaction> & { id: string; date: string; categoryId: string; myAmountCents: number },
): Transaction => ({
  ...base,
  amountCents: p.myAmountCents,
  note: '',
  ...p,
})

export const cat = (
  id: string,
  type: Category['type'],
  fix = false,
  rolloverFrom: string | null = null,
): Category => ({
  ...base,
  id,
  areaId: 'a',
  name: id,
  type,
  fix,
  rolloverFrom,
  hidden: false,
  order: 0,
})

export const bud = (
  id: string,
  categoryId: string,
  validFrom: string,
  amountCents: number,
): Budget => ({
  ...base,
  id,
  categoryId,
  validFrom,
  amountCents,
})
