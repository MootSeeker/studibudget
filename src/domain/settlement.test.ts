import { describe, expect, it } from 'vitest'
import {
  balances,
  buildSettlement,
  effectsOf,
  settlementEffect,
  suggestSettlement,
} from './settlement'
import { buildSharedEqual, buildSharedPartner } from './split'
import type { Settlement, Transaction } from './types'

const base = { deleted: false, updatedAt: '' }
let n = 0
const tx = (shared: Transaction['shared'], over: Partial<Transaction> = {}): Transaction => ({
  ...base,
  id: `t${++n}`,
  date: '2026-10-01',
  categoryId: 'c',
  amountCents: 0,
  myAmountCents: 0,
  note: '',
  shared,
  ...over,
})
const settle = (
  personId: string,
  direction: Settlement['direction'],
  amountCents: number,
  over: Partial<Settlement> = {},
): Settlement => ({
  ...base,
  id: `s${++n}`,
  date: '2026-10-05',
  personId,
  direction,
  amountCents,
  note: '',
  ...over,
})

describe('effectsOf', () => {
  it('ich bezahle 90.00 für drei: Anna und Ben schulden mir je 30.00', () => {
    expect(effectsOf(tx(buildSharedEqual(9000, 'me', ['me', 'anna', 'ben'])))).toEqual([
      { personId: 'anna', cents: 3000 },
      { personId: 'ben', cents: 3000 },
    ])
  })
  it('Anna bezahlt 60.00 für uns beide: ich schulde Anna 30.00', () => {
    expect(effectsOf(tx(buildSharedEqual(6000, 'anna', ['me', 'anna'])))).toEqual([
      { personId: 'anna', cents: -3000 },
    ])
  })
  it('Anna bezahlt für Anna und Ben, ich bin nicht beteiligt: keine Wirkung auf mich', () => {
    expect(effectsOf(tx(buildSharedEqual(6000, 'anna', ['anna', 'ben'])))).toEqual([])
  })
  it('Partner 60/40: ich bezahle 100.00, sie schuldet mir 40.00', () => {
    expect(effectsOf(tx(buildSharedPartner(10000, 'me', 'mia', 60)))).toEqual([
      { personId: 'mia', cents: 4000 },
    ])
  })
  it('nicht geteilte und gelöschte Buchungen wirken nicht', () => {
    expect(effectsOf(tx(undefined))).toEqual([])
    expect(effectsOf(tx(buildSharedEqual(9000, 'me', ['me', 'anna']), { deleted: true }))).toEqual(
      [],
    )
  })
  it('Ausgleichszahlung: «ich zahle» erhöht, «ich erhalte» senkt den Saldo', () => {
    expect(settlementEffect(settle('anna', 'ich_zahle', 500))).toEqual({
      personId: 'anna',
      cents: 500,
    })
    expect(settlementEffect(settle('anna', 'ich_erhalte', 500))).toEqual({
      personId: 'anna',
      cents: -500,
    })
  })
})

describe('balances', () => {
  it('summiert über mehrere Buchungen und Zahlungen, gelöschte zählen nicht', () => {
    const txs = [
      tx(buildSharedEqual(9000, 'me', ['me', 'anna', 'ben'])), // anna +30, ben +30
      tx(buildSharedEqual(4000, 'anna', ['me', 'anna'])), // anna −20
      tx(buildSharedEqual(9999, 'me', ['me', 'anna']), { deleted: true }),
    ]
    const b = balances(txs, [
      settle('ben', 'ich_erhalte', 3000),
      settle('anna', 'ich_erhalte', 1000, { deleted: true }),
    ])
    expect(b.get('anna')).toBe(1000)
    expect(b.get('ben')).toBe(0)
  })
  it('Zahlungen und Buchungen heben sich auf', () => {
    const t = tx(buildSharedEqual(6000, 'anna', ['me', 'anna']))
    expect(balances([t], [settle('anna', 'ich_zahle', 3000)]).get('anna')).toBe(0)
  })
})

describe('buildSettlement', () => {
  const ok = {
    id: 's',
    personId: 'anna',
    direction: 'ich_erhalte' as const,
    amount: "1'234,5",
    date: '2026-10-05',
    note: ' Miete ',
  }
  it('gültige Eingabe → Entwurf in Cent mit bereinigter Notiz', () => {
    const r = buildSettlement(ok)
    expect(r).toEqual({
      ok: true,
      draft: {
        id: 's',
        deleted: false,
        date: '2026-10-05',
        personId: 'anna',
        direction: 'ich_erhalte',
        amountCents: 123450,
        note: 'Miete',
      },
    })
  })
  it.each([
    [{ personId: '' }, 'Person'],
    [{ amount: '' }, 'gültigen Betrag'],
    [{ amount: 'abc' }, 'gültigen Betrag'],
    [{ amount: '0' }, 'grösser als 0'],
    [{ amount: '-5' }, 'grösser als 0'],
    [{ amount: '99999999999' }, 'zu gross'],
    [{ date: '2026-13-01' }, 'Datum'],
    [{ date: '5.10.2026' }, 'Datum'],
    [{ note: 'x'.repeat(201) }, 'Notiz'],
  ])('lehnt %j ab', (patch, msg) => {
    const r = buildSettlement({ ...ok, ...patch })
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.error).toContain(msg)
  })
})

describe('suggestSettlement', () => {
  it('schuldet sie mir etwas, erhalte ich; schulde ich ihr, zahle ich; ausgeglichen → nichts', () => {
    expect(suggestSettlement(3000)).toEqual({ direction: 'ich_erhalte', cents: 3000 })
    expect(suggestSettlement(-1250)).toEqual({ direction: 'ich_zahle', cents: 1250 })
    expect(suggestSettlement(0)).toBeNull()
  })
})
