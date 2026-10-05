import { exportBackup, parseBackup } from '../data/backup'
import { defaultSemesters } from '../domain/period'
import type { ResetKind } from '../domain/reset'
import { db } from '../data/db'
import { completeOnboarding } from '../data/onboarding'
import { store } from '../data/store'

const uuid = (n: string) => `00000000-0000-4000-8000-0000000000${n}`
export const ID = {
  b1: uuid('01'),
  v1: uuid('02'),
  z1: uuid('03'),
  t1: uuid('04'),
  t2: uuid('05'),
  s1: uuid('06'),
  k1: uuid('07'),
  ks1: uuid('08'),
}
/** Nicht gelöschte Einträge einer Tabelle. */
export const live = async (name: ResetKind) =>
  (await db.table(name).toArray()).filter((r: { deleted: boolean }) => !r.deleted)

/** Bestünde der aktuelle Stand als Backup die Prüfung? (Keine Verweise ins Leere.) */
export async function backupOk(): Promise<boolean> {
  return parseBackup(JSON.stringify(await exportBackup(db))).ok
}

/** Ein Konto mit allem, was sich gegenseitig referenziert: Vorlage ← Buchung, Sparziel ← Sparbuchung, Konto ← Stand. */
export async function seed() {
  await db.wipe()
  await completeOnboarding(db, {
    country: 'CH',
    living: 'wg',
    hasCar: false,
    partnerSharePct: 50,
    persons: ['Anna'],
    semesters: defaultSemesters('CH'),
    budgets: {},
  })
  const cats = await db.categories.toArray()
  const miete = cats.find((c) => c.catalogKey === 'miete')!
  const sparen = cats.find((c) => c.type === 'sparen')!
  const anna = (await db.persons.toArray())[0]
  await store.put('budgets', {
    id: ID.b1,
    deleted: false,
    categoryId: miete.id,
    validFrom: '2026-01',
    amountCents: 80000,
  })
  await store.put('templates', {
    id: ID.v1,
    deleted: false,
    categoryId: miete.id,
    amountCents: 80000,
    note: 'Miete',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    active: true,
  })
  await store.put('goals', {
    id: ID.z1,
    deleted: false,
    name: 'Velo',
    targetCents: 50000,
    targetDate: null,
    startCents: 0,
    archived: false,
  })
  await store.put('transactions', {
    id: ID.t1,
    deleted: false,
    date: '2026-03-01',
    categoryId: miete.id,
    amountCents: 80000,
    myAmountCents: 80000,
    note: 'Miete',
    templateId: ID.v1,
    templateMonth: '2026-03',
  })
  await store.put('transactions', {
    id: ID.t2,
    deleted: false,
    date: '2026-03-05',
    categoryId: sparen.id,
    amountCents: 2000,
    myAmountCents: 2000,
    note: '',
    goalId: ID.z1,
    goalDirection: 'einzahlung',
  })
  await store.put('settlements', {
    id: ID.s1,
    deleted: false,
    date: '2026-03-10',
    personId: anna.id,
    direction: 'ich_erhalte',
    amountCents: 4500,
    note: '',
  })
  await store.put('accounts', {
    id: ID.k1,
    deleted: false,
    name: 'Konto',
    kind: 'bank',
    include: true,
    order: 0,
  })
  await store.put('accountBalances', {
    id: ID.ks1,
    deleted: false,
    accountId: ID.k1,
    month: '2026-03',
    amountCents: 100000,
  })
}
