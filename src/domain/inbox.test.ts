import { describe, expect, it } from 'vitest'
import type { Category } from './types'
import { checkInboxPayload, GRUND_GENAU_EINER, GRUND_ID_PASST_NICHT, planInbox } from './inbox'

function cat(id: string, name: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    name,
    areaId: 'a1',
    type: 'ausgabe',
    fix: false,
    rolloverFrom: null,
    hidden: false,
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...extra,
  } as Category
}

const CATS = [cat('k1', 'Einkauf zuhause')]
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const E = {
  id: U1,
  date: '2026-10-09',
  amountCents: 1850,
  categoryName: 'Einkauf zuhause',
  note: 'Mittagessen',
}
const block = (eintraege: unknown[]) => JSON.stringify({ studibudgetVorschlaege: 1, eintraege })

describe('planInbox (#157)', () => {
  it('AK-5: Einträge widerrufener Verbindungen werden verworfen, unbekannte warten', () => {
    const rows = [
      { connectionId: 'a', proposalId: 'p1' },
      { connectionId: 'b', proposalId: 'p2' },
      { connectionId: 'c', proposalId: 'p3' },
    ]
    const plan = planInbox(rows, [
      { id: 'a', deleted: false },
      { id: 'b', deleted: true },
    ])
    expect(plan.lesen.map((r) => r.proposalId)).toEqual(['p1'])
    expect(plan.verwerfen.map((r) => r.proposalId)).toEqual(['p2'])
    expect(plan.warten.map((r) => r.proposalId)).toEqual(['p3'])
  })
})

describe('checkInboxPayload (#157)', () => {
  it('AK-2: gültiger Eintrag wird zum Vorschlag', () => {
    const r = checkInboxPayload(block([E]), U1, CATS, new Set())
    expect(r).toMatchObject({
      art: 'vorschlag',
      vorschlag: { categoryId: 'k1', amountCents: 1850 },
    })
  })

  it('AK-6: schon gebuchte ID ergibt schonErfasst', () => {
    expect(checkInboxPayload(block([E]), U1, CATS, new Set([U1]))).toEqual({
      art: 'schonErfasst',
    })
  })

  it('AK-2: ID im Inhalt muss zur Vorschlags-ID passen', () => {
    expect(checkInboxPayload(block([E]), U2, CATS, new Set())).toEqual({
      art: 'ungueltig',
      grund: GRUND_ID_PASST_NICHT,
    })
    expect(checkInboxPayload(block([E]), U2, CATS, new Set([U1]))).toEqual({
      art: 'ungueltig',
      grund: GRUND_ID_PASST_NICHT,
    })
  })

  it('AK-2: genau ein Eintrag pro Posteingangszeile', () => {
    expect(checkInboxPayload(block([E, { ...E, id: U2 }]), U1, CATS, new Set())).toEqual({
      art: 'ungueltig',
      grund: GRUND_GENAU_EINER,
    })
    expect(checkInboxPayload(block([]), U1, CATS, new Set())).toEqual({
      art: 'ungueltig',
      grund: GRUND_GENAU_EINER,
    })
  })

  it('AK-2: ungültiger Eintrag liefert den Grund', () => {
    const r = checkInboxPayload(block([{ ...E, categoryName: 'Gibts nicht' }]), U1, CATS, new Set())
    expect(r).toEqual({
      art: 'ungueltig',
      grund: 'Die Kategorie «Gibts nicht» gibt es nicht.',
    })
    expect(checkInboxPayload('kein json', U1, CATS, new Set())).toMatchObject({
      art: 'ungueltig',
    })
  })
})
