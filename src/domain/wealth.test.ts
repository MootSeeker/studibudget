import { describe, expect, it } from 'vitest'
import { accountSeries, enteredBalance, storedBalance, wealthByMonth } from './wealth'
import type { Account, AccountBalance } from './types'

const base = { deleted: false, updatedAt: '' }
const acc = (id: string, kind: Account['kind'], over: Partial<Account> = {}): Account => ({
  ...base,
  id,
  name: id,
  kind,
  include: true,
  order: 0,
  ...over,
})
const bal = (
  accountId: string,
  month: string,
  amountCents: number,
  over: Partial<AccountBalance> = {},
): AccountBalance => ({
  ...base,
  id: `${accountId}-${month}`,
  accountId,
  month,
  amountCents,
  ...over,
})

describe('Schulden', () => {
  it('werden als geschuldeter Betrag eingegeben, aber negativ gespeichert', () => {
    expect(storedBalance('schuld', 12000)).toBe(-12000)
    expect(storedBalance('schuld', -12000)).toBe(-12000) // Vorzeichen egal
    expect(enteredBalance('schuld', -12000)).toBe(12000)
  })
  it('andere Konten bleiben, wie eingegeben (auch überzogen)', () => {
    expect(storedBalance('bank', 500000)).toBe(500000)
    expect(storedBalance('bank', -2000)).toBe(-2000)
    expect(enteredBalance('bank', -2000)).toBe(-2000)
  })
})

describe('wealthByMonth', () => {
  const accounts = [
    acc('privat', 'bank'),
    acc('spar', 'spar'),
    acc('karte', 'schuld'),
    acc('depot', 'depot', { include: false }),
  ]
  const balances = [
    bal('privat', '2026-08', 100000),
    bal('spar', '2026-08', 500000),
    bal('karte', '2026-08', -20000),
    bal('depot', '2026-08', 9999999), // nicht einbezogen
    bal('privat', '2026-09', 120000),
    bal('spar', '2026-09', 500000),
    // Kreditkarte im September fehlt
  ]
  const w = wealthByMonth(accounts, balances, ['2026-08', '2026-09', '2026-10'])

  it('summiert nur einbezogene Konten, Schulden senken das Vermögen', () => {
    expect(w[0]).toEqual({ month: '2026-08', total: 580000, missing: 0, complete: true })
  })
  it('fehlende Angabe ist «unbekannt», nicht 0: Summe unvollständig und gekennzeichnet', () => {
    expect(w[1]).toEqual({ month: '2026-09', total: 620000, missing: 1, complete: false })
  })
  it('Monat ohne jede Angabe hat kein Total', () => {
    expect(w[2]).toEqual({ month: '2026-10', total: null, missing: 3, complete: false })
  })
  it('ein Stand von 0 ist eine Angabe, keine Lücke', () => {
    const r = wealthByMonth([acc('a', 'bank')], [bal('a', '2026-08', 0)], ['2026-08'])[0]
    expect(r).toEqual({ month: '2026-08', total: 0, missing: 0, complete: true })
  })
  it('gelöschte Stände und Konten zählen nicht; ohne Konten nie «vollständig»', () => {
    const r = wealthByMonth(
      [acc('a', 'bank')],
      [bal('a', '2026-08', 100, { deleted: true })],
      ['2026-08'],
    )[0]
    expect(r.total).toBeNull()
    expect(wealthByMonth([], [], ['2026-08'])[0].complete).toBe(false)
    expect(
      wealthByMonth([acc('a', 'bank', { deleted: true })], [bal('a', '2026-08', 5)], ['2026-08'])[0]
        .total,
    ).toBeNull()
  })
})

describe('accountSeries', () => {
  const months = ['2026-08', '2026-09', '2026-10']

  it('AK-1: liefert pro Konto mit Ständen eine Reihe in der Reihenfolge der Konten', () => {
    const r = accountSeries(
      [acc('privat', 'bank'), acc('karte', 'schuld'), acc('depot', 'depot', { include: false })],
      [
        bal('privat', '2026-08', 100000),
        bal('privat', '2026-09', 120000),
        bal('karte', '2026-08', -20000),
        bal('depot', '2026-10', 9999),
      ],
      months,
    )
    expect(r).toEqual([
      { accountId: 'privat', name: 'privat', include: true, values: [100000, 120000, null] },
      { accountId: 'karte', name: 'karte', include: true, values: [-20000, null, null] },
      { accountId: 'depot', name: 'depot', include: false, values: [null, null, 9999] },
    ])
  })

  it('AK-4: gelöschte Konten, gelöschte Stände und Konten ohne Stand ergeben keine Reihe', () => {
    const r = accountSeries(
      [
        acc('weg', 'bank', { deleted: true }),
        acc('grab', 'bank'),
        acc('leer', 'bank'),
        acc('da', 'spar'),
      ],
      [
        bal('weg', '2026-08', 100),
        bal('grab', '2026-08', 200, { deleted: true }),
        bal('da', '2026-09', 300),
        bal('da', '2026-07', 400),
      ],
      months,
    )
    expect(r.map((s) => s.accountId)).toEqual(['da'])
    expect(r[0].values).toEqual([null, 300, null])
  })

  it('AK-6: ein fehlender Monat bleibt null, ein Stand von 0 ist ein Wert', () => {
    const r = accountSeries(
      [acc('a', 'bank')],
      [bal('a', '2026-08', 0), bal('a', '2026-10', 500)],
      months,
    )
    expect(r[0].values).toEqual([0, null, 500])
  })
})
