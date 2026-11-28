import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Settings, Synced } from '../domain/types'
import { db } from './db'
import {
  useAccountBalances,
  useAccounts,
  useAllCars,
  useAllGoals,
  useAllTransactions,
  useAreas,
  useBudgets,
  useCars,
  useCategories,
  useGoals,
  useMonthTransactions,
  usePersons,
  useSettings,
  useSettlements,
  useTemplates,
} from './hooks'
import { SETTINGS_ID } from './seed'
import { store } from './store'

// Integrationstests der Lese-Hooks mit echtem Store und fake-indexeddb (#147): Grabsteine, Archiv, Sortierung,
// Monatsauswahl, Startwerte und Live-Aktualisierung.

const lebt = { deleted: false }
const grab = { deleted: true }
const ids = (rows: Synced[] | undefined) => (rows ?? []).map((r) => r.id)

const settings = (over: Partial<Settings> = {}): Omit<Settings, 'updatedAt'> => ({
  id: SETTINGS_ID,
  ...lebt,
  country: 'CH' as const,
  living: 'allein' as const,
  hasCar: false,
  myPartnerSharePct: 50,
  semesters: [],
  ampel: { yellowPct: 80, redPct: 100 },
  theme: 'system' as const,
  backupReminderDays: 30,
  lastBackupAt: null,
  onboardingDone: true,
  ...over,
})
const area = (id: string, order: number, over: object = {}) => ({
  id,
  ...lebt,
  name: id,
  order,
  hidden: false,
  ...over,
})
const category = (id: string, over: object = {}) => ({
  id,
  ...lebt,
  areaId: 'a',
  name: id,
  type: 'ausgabe' as const,
  fix: false,
  rolloverFrom: null,
  hidden: false,
  order: 0,
  ...over,
})
const goal = (id: string, over: object = {}) => ({
  id,
  ...lebt,
  name: id,
  targetCents: 1000,
  targetDate: null,
  startCents: 0,
  archived: false,
  ...over,
})
const car = (id: string, order: number, over: object = {}) => ({
  id,
  ...lebt,
  name: id,
  archived: false,
  order,
  ...over,
})
const account = (id: string, order: number, over: object = {}) => ({
  id,
  ...lebt,
  name: id,
  kind: 'bank' as const,
  include: true,
  order,
  ...over,
})
const tx = (id: string, date: string, over: object = {}) => ({
  id,
  ...lebt,
  date,
  categoryId: 'c',
  amountCents: 100,
  myAmountCents: 100,
  note: '',
  ...over,
})
const template = (id: string, over: object = {}) => ({
  id,
  ...lebt,
  categoryId: 'c',
  amountCents: 100,
  note: '',
  months: [1],
  active: true,
  ...over,
})

beforeEach(async () => {
  await db.wipe()
})

describe('Startwerte (AK-6)', () => {
  it('useSettings ist zuerst undefined (lädt), danach null ohne Einstellungen', async () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBeNull())
  })

  it.each([
    ['usePersons', usePersons],
    ['useCategories', useCategories],
    ['useAreas', useAreas],
    ['useGoals', useGoals],
    ['useCars', useCars],
    ['useAllCars', useAllCars],
    ['useTemplates', useTemplates],
    ['useBudgets', useBudgets],
    ['useAllTransactions', useAllTransactions],
    ['useAccounts', useAccounts],
    ['useAccountBalances', useAccountBalances],
    ['useAllGoals', useAllGoals],
    ['useSettlements', useSettlements],
  ] as const)('%s startet mit einer leeren Liste', (_name, hook) => {
    const { result } = renderHook(() => hook())
    expect(result.current).toEqual([])
  })

  it('useMonthTransactions startet mit einer leeren Liste', () => {
    const { result } = renderHook(() => useMonthTransactions('2026-10'))
    expect(result.current).toEqual([])
  })
})

describe('Grabsteine (AK-1)', () => {
  it('useSettings liefert Einstellungen, als Grabstein aber null', async () => {
    await store.put('settings', settings())
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current?.id).toBe(SETTINGS_ID))
    await db.settings.put({ ...settings(grab), updatedAt: '' })
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('alle Listen-Hooks lassen Grabsteine weg', async () => {
    await db.persons.bulkPut([
      { id: 'p1', ...lebt, updatedAt: '', name: 'Anna', active: true },
      { id: 'p2', ...grab, updatedAt: '', name: 'Ben', active: true },
    ])
    await db.categories.bulkPut([
      { ...category('c1'), updatedAt: '' },
      { ...category('c2', grab), updatedAt: '' },
    ])
    await db.areas.bulkPut([
      { ...area('a1', 0), updatedAt: '' },
      { ...area('a2', 1, grab), updatedAt: '' },
    ])
    await db.goals.bulkPut([
      { ...goal('g1'), updatedAt: '' },
      { ...goal('g2', grab), updatedAt: '' },
    ])
    await db.cars.bulkPut([
      { ...car('k1', 0), updatedAt: '' },
      { ...car('k2', 1, grab), updatedAt: '' },
    ])
    await db.templates.bulkPut([
      { ...template('v1'), updatedAt: '' },
      { ...template('v2', grab), updatedAt: '' },
    ])
    await db.budgets.bulkPut([
      { id: 'b1', ...lebt, updatedAt: '', categoryId: 'c1', validFrom: '2026-01', amountCents: 1 },
      { id: 'b2', ...grab, updatedAt: '', categoryId: 'c1', validFrom: '2026-02', amountCents: 1 },
    ])
    await db.transactions.bulkPut([
      { ...tx('t1', '2026-10-01'), updatedAt: '' },
      { ...tx('t2', '2026-10-02', grab), updatedAt: '' },
    ])
    await db.accounts.bulkPut([
      { ...account('k1', 0), updatedAt: '' },
      { ...account('k2', 1, grab), updatedAt: '' },
    ])
    await db.accountBalances.bulkPut([
      { id: 's1', ...lebt, updatedAt: '', accountId: 'k1', month: '2026-10', amountCents: 1 },
      { id: 's2', ...grab, updatedAt: '', accountId: 'k1', month: '2026-11', amountCents: 1 },
    ])
    await db.settlements.bulkPut([
      {
        id: 'z1',
        ...lebt,
        updatedAt: '',
        date: '2026-10-01',
        personId: 'p1',
        direction: 'ich_zahle' as const,
        amountCents: 1,
        note: '',
      },
      {
        id: 'z2',
        ...grab,
        updatedAt: '',
        date: '2026-10-01',
        personId: 'p1',
        direction: 'ich_zahle' as const,
        amountCents: 1,
        note: '',
      },
    ])
    const faelle: [string, () => Synced[] | undefined, string[]][] = [
      ['usePersons', usePersons, ['p1']],
      ['useCategories', useCategories, ['c1']],
      ['useAreas', useAreas, ['a1']],
      ['useGoals', useGoals, ['g1']],
      ['useAllGoals', useAllGoals, ['g1']],
      ['useCars', useCars, ['k1']],
      ['useAllCars', useAllCars, ['k1']],
      ['useTemplates', useTemplates, ['v1']],
      ['useBudgets', useBudgets, ['b1']],
      ['useAllTransactions', useAllTransactions, ['t1']],
      ['useMonthTransactions', () => useMonthTransactions('2026-10'), ['t1']],
      ['useAccounts', useAccounts, ['k1']],
      ['useAccountBalances', useAccountBalances, ['s1']],
      ['useSettlements', useSettlements, ['z1']],
    ]
    for (const [name, hook, erwartet] of faelle) {
      const { result, unmount } = renderHook(() => hook())
      await waitFor(() => expect(ids(result.current), name).toEqual(erwartet))
      unmount()
    }
  })
})

describe('Sortierung nach order (AK-2)', () => {
  it('useAreas, useCars, useAllCars und useAccounts aufsteigend nach order', async () => {
    await db.areas.bulkPut([2, 0, 1].map((o) => ({ ...area(`a${o}`, o), updatedAt: '' })))
    await db.cars.bulkPut([2, 0, 1].map((o) => ({ ...car(`k${o}`, o), updatedAt: '' })))
    await db.accounts.bulkPut([2, 0, 1].map((o) => ({ ...account(`k${o}`, o), updatedAt: '' })))
    const faelle: [() => Synced[] | undefined, string[]][] = [
      [useAreas, ['a0', 'a1', 'a2']],
      [useCars, ['k0', 'k1', 'k2']],
      [useAllCars, ['k0', 'k1', 'k2']],
      [useAccounts, ['k0', 'k1', 'k2']],
    ]
    for (const [hook, erwartet] of faelle) {
      const { result, unmount } = renderHook(() => hook())
      await waitFor(() => expect(ids(result.current)).toEqual(erwartet))
      unmount()
    }
  })
})

describe('Archiv (AK-3)', () => {
  it('archivierte Ziele und Autos fehlen in useGoals/useCars, nicht in useAllGoals/useAllCars', async () => {
    await db.goals.bulkPut([
      { ...goal('g1'), updatedAt: '' },
      { ...goal('g2', { archived: true }), updatedAt: '' },
    ])
    await db.cars.bulkPut([
      { ...car('k1', 1), updatedAt: '' },
      { ...car('k0', 0, { archived: true }), updatedAt: '' },
    ])
    const goals = renderHook(() => useGoals())
    const allGoals = renderHook(() => useAllGoals())
    const cars = renderHook(() => useCars())
    const allCars = renderHook(() => useAllCars())
    await waitFor(() => {
      expect(ids(goals.result.current)).toEqual(['g1'])
      expect(ids(allGoals.result.current).sort()).toEqual(['g1', 'g2'])
      expect(ids(cars.result.current)).toEqual(['k1'])
      expect(ids(allCars.result.current)).toEqual(['k0', 'k1'])
    })
  })
})

describe('useMonthTransactions (AK-4, AK-5)', () => {
  beforeEach(async () => {
    await db.transactions.bulkPut(
      [
        tx('okt', '2026-10-15'),
        tx('okt-anfang', '2026-10-01'),
        tx('okt-ende', '2026-10-31'),
        tx('sep', '2026-09-30'),
        tx('nov', '2026-11-01'),
        // Aus der Vorlage für Oktober, aber auf den 2. November verschoben
        tx('vorlage-okt', '2026-11-02', { templateId: 'v', templateMonth: '2026-10' }),
        // Aus der Vorlage für November, auf Ende Oktober vorgezogen
        tx('vorlage-nov', '2026-10-30', { templateId: 'v', templateMonth: '2026-11' }),
      ].map((t) => ({ ...t, updatedAt: '' })),
    )
  })

  it('AK-4: Buchungen mit Datum im Monat und mit templateMonth gleich dem Monat, keine anderen', async () => {
    const { result } = renderHook(() => useMonthTransactions('2026-10'))
    await waitFor(() =>
      expect(ids(result.current).sort()).toEqual(
        ['okt', 'okt-anfang', 'okt-ende', 'vorlage-nov', 'vorlage-okt'].sort(),
      ),
    )
  })

  it('AK-5: wechselt der Monat, zeigt der Hook die Buchungen des neuen Monats', async () => {
    const { result, rerender } = renderHook(({ m }) => useMonthTransactions(m), {
      initialProps: { m: '2026-10' },
    })
    await waitFor(() => expect(ids(result.current)).toContain('okt'))
    rerender({ m: '2026-11' })
    await waitFor(() =>
      expect(ids(result.current).sort()).toEqual(['nov', 'vorlage-nov', 'vorlage-okt'].sort()),
    )
    rerender({ m: '2026-09' })
    await waitFor(() => expect(ids(result.current)).toEqual(['sep']))
  })
})

describe('Live-Aktualisierung über den Store (AK-7)', () => {
  it('put, patch und remove erscheinen ohne erneutes Rendern von aussen', async () => {
    const { result } = renderHook(() => useAreas())
    await waitFor(() => expect(result.current).toEqual([]))
    await store.put('areas', area('b', 1))
    await store.put('areas', area('a', 2))
    await waitFor(() => expect(ids(result.current)).toEqual(['b', 'a']))
    await store.patch('areas', 'a', { order: 0 })
    await waitFor(() => expect(ids(result.current)).toEqual(['a', 'b']))
    await store.remove('areas', 'b')
    await waitFor(() => expect(ids(result.current)).toEqual(['a']))
  })

  it('useSettings folgt patch und remove', async () => {
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current).toBeNull())
    await store.put('settings', settings())
    await waitFor(() => expect(result.current?.country).toBe('CH'))
    await store.patch('settings', SETTINGS_ID, { country: 'DE' })
    await waitFor(() => expect(result.current?.country).toBe('DE'))
    await store.remove('settings', SETTINGS_ID)
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('useMonthTransactions folgt einer verschobenen Buchung in einen anderen Monat', async () => {
    const { result } = renderHook(() => useMonthTransactions('2026-10'))
    await store.put('transactions', tx('t', '2026-10-05'))
    await waitFor(() => expect(ids(result.current)).toEqual(['t']))
    await store.patch('transactions', 't', { date: '2026-11-05' })
    await waitFor(() => expect(ids(result.current)).toEqual([]))
  })
})
