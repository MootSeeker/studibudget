import { describe, expect, it } from 'vitest'
import { bud, cat } from '../test/factories'
import { exportBudgetFile, parseBudgetFile, planBudgetImport } from './budgetFile'

const miete = { ...cat('c1', 'ausgabe'), name: 'Miete' }
const lohn = { ...cat('c2', 'einnahme'), name: 'Lohn' }

describe('Budget-Datei', () => {
  it('exportiert Werte mit Namen, ohne gelöschte, sortiert', () => {
    const file = exportBudgetFile(
      [miete, lohn, { ...cat('c3', 'ausgabe'), name: 'Weg', deleted: true }],
      [
        bud('b1', 'c1', '2026-03', 80000),
        bud('b2', 'c2', '2026-01', 200000),
        { ...bud('b3', 'c1', '2026-01', 1), deleted: true },
        bud('b4', 'c3', '2026-01', 5),
        bud('b5', 'gibtsnicht', '2026-01', 5),
      ],
      new Date('2026-10-05T10:00:00Z'),
    )
    expect(file.items).toEqual([
      { name: 'Lohn', type: 'einnahme', validFrom: '2026-01', amountCents: 200000 },
      { name: 'Miete', type: 'ausgabe', validFrom: '2026-03', amountCents: 80000 },
    ])
  })

  it('Export und Import sind eine Runde ohne Verlust', () => {
    const file = exportBudgetFile([miete, lohn], [bud('b1', 'c1', '2026-03', 80000)])
    const parsed = parseBudgetFile(JSON.stringify(file))
    expect(parsed).toEqual({ ok: true, items: file.items })
  })

  it.each([
    ['kein JSON', 'xx', /JSON/],
    ['null', 'null', /keine Budget-Datei/],
    ['fremde App', '{"app":"x","kind":"budget"}', /keine Budget-Datei/],
    ['Backup statt Budget', '{"app":"studibudget","kind":"backup"}', /keine Budget-Datei/],
    [
      'falsche Version',
      '{"app":"studibudget","kind":"budget","schemaVersion":9,"items":[]}',
      /Version/,
    ],
    ['ohne Liste', '{"app":"studibudget","kind":"budget","schemaVersion":1}', /keine Budgetwerte/],
  ])('lehnt ab: %s', (_n, raw, msg) => {
    const r = parseBudgetFile(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(msg)
  })

  it.each([
    { name: '', type: 'ausgabe', validFrom: '2026-01', amountCents: 1 },
    { name: 'A', type: 'sonst', validFrom: '2026-01', amountCents: 1 },
    { name: 'A', type: 'ausgabe', validFrom: '2026-13', amountCents: 1 },
    { name: 'A', type: 'ausgabe', validFrom: '2026-01', amountCents: -1 },
    { name: 'A', type: 'ausgabe', validFrom: '2026-01', amountCents: 1.5 },
    { name: 'A', type: 'ausgabe', validFrom: '2026-01', amountCents: '5' },
  ])('lehnt einen ungültigen Eintrag ab: %j', (item) => {
    const raw = JSON.stringify({
      app: 'studibudget',
      kind: 'budget',
      schemaVersion: 1,
      items: [item],
    })
    const r = parseBudgetFile(raw)
    expect(r).toEqual({ ok: false, error: 'Eintrag 1 ist ungültig.' })
  })

  it('ordnet beim Import nach Name (ohne Gross/Klein) und Art zu und meldet Fehlendes', () => {
    const plan = planBudgetImport(
      [
        { name: ' miete ', type: 'ausgabe', validFrom: '2026-01', amountCents: 5 },
        { name: 'Miete', type: 'einnahme', validFrom: '2026-01', amountCents: 6 },
        { name: 'Yoga', type: 'ausgabe', validFrom: '2026-01', amountCents: 7 },
        { name: 'Yoga', type: 'ausgabe', validFrom: '2026-02', amountCents: 8 },
      ],
      [miete, lohn],
    )
    expect(plan.matched).toEqual([{ categoryId: 'c1', validFrom: '2026-01', amountCents: 5 }])
    expect(plan.skipped).toEqual(['Miete', 'Yoga'])
  })
})
