import { describe, expect, it } from 'vitest'
import { buildInvoice } from './invoice'
import { balances } from './settlement'
import type { Settlement, Transaction } from './types'

const cats = [{ id: 'c1', name: 'Einkauf' }]
const tx = (
  id: string,
  date: string,
  paidBy: string,
  mine: number,
  other: number,
  note = '',
): Transaction =>
  ({
    id,
    deleted: false,
    date,
    categoryId: 'c1',
    amountCents: mine + other,
    myAmountCents: mine,
    note,
    shared: {
      paidBy,
      parts: [
        { who: 'me', cents: mine },
        { who: 'anna', cents: other },
      ],
    },
    updatedAt: '',
  }) as Transaction
const pay = (
  id: string,
  date: string,
  direction: Settlement['direction'],
  amountCents: number,
  note = '',
  deleted = false,
): Settlement => ({
  id,
  deleted,
  date,
  personId: 'anna',
  direction,
  amountCents,
  note,
  updatedAt: '',
})

describe('buildInvoice', () => {
  const txs = [
    tx('2', '2026-10-05', 'me', 1000, 1000),
    tx('1', '2026-10-01', 'me', 500, 500, 'Pizza'),
    tx('3', '2026-10-03', 'anna', 300, 300),
  ]
  const sets = [
    pay('s1', '2026-10-07', 'ich_erhalte', 400, 'Twint'),
    pay('s2', '2026-10-08', 'ich_erhalte', 99, '', true),
  ]

  it('listet Positionen nach Datum mit Notiz, sonst Kategorie (AK-2)', () => {
    const inv = buildInvoice('anna', txs, sets, cats)
    expect(inv.positions.map((p) => [p.date, p.description, p.cents])).toEqual([
      ['2026-10-01', 'Pizza', 500],
      ['2026-10-03', 'Einkauf', -300],
      ['2026-10-05', 'Einkauf', 1000],
    ])
    expect(inv.deductions).toEqual([{ date: '2026-10-07', description: 'Twint', cents: -400 }])
  })

  it('Total entspricht dem Saldo (AK-3)', () => {
    const inv = buildInvoice('anna', txs, sets, cats)
    expect(inv.totalCents).toBe(balances(txs, sets).get('anna'))
    expect(inv.totalCents).toBe(800)
  })

  it('ignoriert gelöschte Buchungen und andere Personen', () => {
    const del = { ...txs[0], deleted: true }
    expect(buildInvoice('anna', [del], [], cats).positions).toEqual([])
    expect(buildInvoice('ben', txs, sets, cats).totalCents).toBe(0)
  })
})
