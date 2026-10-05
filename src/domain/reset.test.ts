import { describe, expect, it } from 'vitest'
import { base, bud, tx } from '../test/factories'
import { effectiveSelection, planReset, type ResetData } from './reset'
import type { Account, AccountBalance, Goal, Settlement, Template } from './types'

const template: Template = {
  ...base,
  id: 'v1',
  categoryId: 'c',
  amountCents: 80000,
  note: 'Miete',
  months: [],
  active: true,
}
const settlement: Settlement = {
  ...base,
  id: 's1',
  date: '2026-03-01',
  personId: 'p',
  direction: 'ich_erhalte',
  amountCents: 100,
  note: '',
}
const account: Account = { ...base, id: 'k1', name: 'Konto', kind: 'bank', include: true, order: 0 }
const balance: AccountBalance = {
  ...base,
  id: 'ks1',
  accountId: 'k1',
  month: '2026-03',
  amountCents: 5,
}
const goal: Goal = {
  ...base,
  id: 'z1',
  name: 'Velo',
  targetCents: 50000,
  targetDate: null,
  startCents: 0,
  archived: false,
}

function data(): ResetData {
  return {
    budgets: [bud('b1', 'c', '2026-01', 100), { ...bud('b2', 'c', '2026-02', 5), deleted: true }],
    transactions: [
      tx({ id: 't1', date: '2026-03-02', categoryId: 'c', myAmountCents: 80000 }),
      tx({
        id: 't2',
        date: '2026-03-01',
        categoryId: 'c',
        myAmountCents: 80000,
        templateId: 'v1',
        templateMonth: '2026-03',
      }),
      tx({
        id: 't3',
        date: '2026-03-05',
        categoryId: 's',
        myAmountCents: 2000,
        goalId: 'z1',
        goalDirection: 'einzahlung',
      }),
    ],
    templates: [template],
    settlements: [settlement],
    accounts: [account],
    accountBalances: [balance],
    goals: [goal],
  }
}

const deletedIds = (plan: ReturnType<typeof planReset>) =>
  plan.writes.flatMap((w) =>
    w.drafts
      .filter((d) => (d as { deleted: boolean }).deleted)
      .map((d) => (d as { id: string }).id),
  )

describe('Daten zurücksetzen (Issue #30)', () => {
  it('ohne Auswahl wird nichts geschrieben', () => {
    const plan = planReset(data(), [])
    expect(plan.total).toBe(0)
    expect(plan.writes).toEqual([])
  })

  it('löscht nur die gewählte Art und nur lebende Einträge', () => {
    const plan = planReset(data(), ['budgets'])
    expect(plan.counts.budgets).toBe(1)
    expect(plan.total).toBe(1)
    expect(deletedIds(plan)).toEqual(['b1'])
  })

  it('Konten ziehen ihre Kontostände mit, Kontostände allein lassen die Konten stehen', () => {
    expect([...effectiveSelection(['accounts'])].sort()).toEqual(['accountBalances', 'accounts'])
    expect(deletedIds(planReset(data(), ['accounts'])).sort()).toEqual(['k1', 'ks1'])
    expect(deletedIds(planReset(data(), ['accountBalances']))).toEqual(['ks1'])
  })

  it('Vorlagen weg, Buchungen bleiben: die Buchung verliert nur den Verweis auf die Vorlage', () => {
    const plan = planReset(data(), ['templates'])
    expect(plan.detachedFromTemplates).toBe(1)
    const cleaned = plan.writes.find((w) => w.name === 'transactions')!.drafts as Record<
      string,
      unknown
    >[]
    expect(cleaned).toHaveLength(1)
    expect(cleaned[0]).toMatchObject({ id: 't2', deleted: false, myAmountCents: 80000 })
    expect(cleaned[0]).not.toHaveProperty('templateId')
    expect(cleaned[0]).not.toHaveProperty('templateMonth')
    expect(deletedIds(plan)).toEqual(['v1'])
  })

  it('Sparziele weg, Buchungen bleiben: die Sparbuchung bleibt ohne Sparziel', () => {
    const plan = planReset(data(), ['goals'])
    expect(plan.detachedFromGoals).toBe(1)
    const cleaned = plan.writes.find((w) => w.name === 'transactions')!.drafts[0]
    expect(cleaned).toMatchObject({ id: 't3', deleted: false })
    expect(cleaned).not.toHaveProperty('goalId')
    expect(cleaned).not.toHaveProperty('goalDirection')
  })

  it('werden die Buchungen mitgelöscht, gibt es nichts zu bereinigen', () => {
    const plan = planReset(data(), ['templates', 'goals', 'transactions'])
    expect(plan.detachedFromTemplates).toBe(0)
    expect(plan.detachedFromGoals).toBe(0)
    expect(plan.writes.filter((w) => w.name === 'transactions')).toHaveLength(1)
    expect(plan.counts.transactions).toBe(3)
  })

  it('alles gewählt löscht jeden lebenden Eintrag genau einmal', () => {
    const plan = planReset(data(), [
      'budgets',
      'transactions',
      'templates',
      'settlements',
      'accounts',
      'goals',
    ])
    expect(plan.total).toBe(9)
    expect(new Set(deletedIds(plan)).size).toBe(9)
  })

  it('die Eingabe bleibt unverändert', () => {
    const d = data()
    const before = JSON.stringify(d)
    planReset(d, ['templates', 'goals'])
    expect(JSON.stringify(d)).toBe(before)
  })
})
