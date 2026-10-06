// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyBackup, backupFileName, exportBackup, parseBackup, type Backup } from './backup'
import { StudiBudgetDB } from './db'
import { completeOnboarding } from './onboarding'
import { createStore, SYNCED_TABLES } from './store'
import { newId, SETTINGS_ID } from './seed'
import { defaultSemesters } from '../domain/period'
import { buildSharedEqual } from '../domain/split'

let n = 0
const fresh = () => new StudiBudgetDB(`bak-${++n}-${Math.random()}`)

/** Ein realistischer Datenbestand mit allen Tabellen. */
async function populate(db: StudiBudgetDB) {
  await completeOnboarding(
    db,
    {
      country: 'CH',
      living: 'wg',
      hasCar: false,
      partnerSharePct: 50,
      persons: ['Anna', 'Ben'],
      semesters: defaultSemesters('CH'),
      budgets: { miete: 80000, einkauf: 40000 },
    },
    '2026-10',
  )
  const store = createStore(db)
  const cats = await db.categories.toArray()
  const cat = (k: string) => cats.find((c) => c.catalogKey === k)!
  const anna = (await db.persons.toArray()).find((p) => p.name === 'Anna')!
  const shared = buildSharedEqual(9000, 'me', ['me', anna.id])
  const goalId = newId()
  await store.put('goals', {
    id: goalId,
    deleted: false,
    name: 'Ferien',
    targetCents: 100000,
    targetDate: '2027-07-31',
    startCents: 5000,
    archived: false,
  })
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date: '2026-10-02',
    categoryId: cat('einkauf').id,
    amountCents: 9000,
    myAmountCents: 4500,
    note: 'Wocheneinkauf',
    shared,
  })
  await store.put('transactions', {
    id: newId(),
    deleted: false,
    date: '2026-10-03',
    categoryId: cat('notgroschen').id,
    amountCents: 2000,
    myAmountCents: 2000,
    note: '',
    goalId,
    goalDirection: 'einzahlung',
  })
  await store.put('templates', {
    id: newId(),
    deleted: false,
    categoryId: cat('miete').id,
    amountCents: 80000,
    note: 'Miete',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    active: true,
  })
  await store.put('settlements', {
    id: newId(),
    deleted: false,
    date: '2026-10-05',
    personId: anna.id,
    direction: 'ich_erhalte',
    amountCents: 1000,
    note: '',
  })
  const accountId = newId()
  await store.put('accounts', {
    id: accountId,
    deleted: false,
    name: 'Privat',
    kind: 'bank',
    include: true,
    order: 0,
  })
  await store.put('accountBalances', {
    id: newId(),
    deleted: false,
    accountId,
    month: '2026-10',
    amountCents: 123456,
  })
}

const strip = (rows: { id: string; updatedAt?: string }[]) =>
  rows.map(({ updatedAt: _u, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id))
const snapshot = async (db: StudiBudgetDB) => {
  const out: Record<string, object[]> = {}
  for (const t of SYNCED_TABLES)
    out[t] = strip((await db.table(t).toArray()).filter((r) => !r.deleted))
  return out
}
const roundtrip = async (db: StudiBudgetDB) => {
  const parsed = parseBackup(JSON.stringify(await exportBackup(db)))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed
}
const clone = (b: Backup): Backup => JSON.parse(JSON.stringify(b))
const errorOf = (r: ReturnType<typeof parseBackup>) => (r.ok ? '' : r.error)

describe('Export', () => {
  it('enthält alle Tabellen, keine Sync-Zeitstempel und keine gelöschten Einträge', async () => {
    const db = fresh()
    await populate(db)
    const store = createStore(db)
    const tx = (await db.transactions.toArray())[0]
    await store.remove('transactions', tx.id)
    const b = await exportBackup(db, new Date('2026-10-20T10:00:00Z'))
    expect(b).toMatchObject({
      app: 'studibudget',
      schemaVersion: 1,
      exportedAt: '2026-10-20T10:00:00.000Z',
    })
    expect(Object.keys(b.data).sort()).toEqual([...SYNCED_TABLES].sort())
    expect(b.data.transactions.map((r) => r.id)).not.toContain(tx.id)
    expect(JSON.stringify(b)).not.toContain('updatedAt')
    expect(b.data.settings).toHaveLength(1)
  })
  it('Bankverbindung (#104, AK-5): ein Backup mit dem Feld übersteht Export und Import, eines ohne bleibt gültig', async () => {
    const a = fresh()
    await populate(a)
    const bank = {
      holder: 'Anna Muster',
      street: 'Seestrasse 12',
      zip: '8000',
      town: 'Zürich',
      country: 'CH' as const,
      iban: 'CH9300762011623852957',
    }
    // ohne Feld: gültig, und nach dem Import steht keines da
    const ohne = await roundtrip(a)
    const c = fresh()
    await applyBackup(c, ohne.backup)
    expect((await c.settings.get(SETTINGS_ID))!.bank).toBeUndefined()
    // mit Feld: exportiert, geprüft und wiederhergestellt
    await createStore(a).patch('settings', SETTINGS_ID, { bank })
    const mit = await roundtrip(a)
    const b = fresh()
    await applyBackup(b, mit.backup)
    expect((await b.settings.get(SETTINGS_ID))!.bank).toEqual(bank)
  })

  it('Bankverbindung (#104): eine ungültige IBAN in der Datei wird abgelehnt', async () => {
    const a = fresh()
    await populate(a)
    await createStore(a).patch('settings', SETTINGS_ID, {
      bank: { holder: '', street: '', zip: '', town: '', country: 'CH', iban: 'keine-iban' },
    })
    const parsed = parseBackup(JSON.stringify(await exportBackup(a)))
    expect(parsed.ok).toBe(false)
  })

  it('Dateiname mit Datum', () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe('studibudget-backup-2026-10-03.json')
  })
})

describe('Rundreise Export → Import', () => {
  it('stellt auf einer leeren Datenbank alles identisch her und merkt es für den Sync vor', async () => {
    const a = fresh()
    await populate(a)
    const { backup, counts } = await roundtrip(a)
    expect(counts.transactions).toBe(2)
    expect(counts.persons).toBe(2)
    const b = fresh()
    await applyBackup(b, backup)
    expect(await snapshot(b)).toEqual(await snapshot(a))
    expect(await b.outbox.count()).toBeGreaterThan(20)
    expect((await b.syncState.get('state'))!.wall).toBeGreaterThan(0)
  })

  it('ersetzt: was nicht im Backup steht, wird gelöscht; Gelöschtes im Backup wird wieder lebendig', async () => {
    const db = fresh()
    await populate(db)
    const { backup } = await roundtrip(db)
    const store = createStore(db)
    const extra = newId()
    const cat = (await db.categories.toArray())[0]
    await store.put('transactions', {
      id: extra,
      deleted: false,
      date: '2026-10-09',
      categoryId: cat.id,
      amountCents: 100,
      myAmountCents: 100,
      note: 'neu',
    })
    const back = (await db.transactions.toArray()).find((t) => t.note === 'Wocheneinkauf')!
    await store.remove('transactions', back.id)
    await applyBackup(db, backup)
    expect((await db.transactions.get(extra))!.deleted).toBe(true) // Tombstone: wird auf andere Geräte synchronisiert
    expect((await db.transactions.get(back.id))!.deleted).toBe(false)
    expect((await db.transactions.get(back.id))!.note).toBe('Wocheneinkauf')
    expect((await snapshot(db)).transactions).toHaveLength(2)
  })

  it('ganz oder gar nicht: scheitert das Schreiben mittendrin, bleibt der alte Stand unverändert', async () => {
    const db = fresh()
    await populate(db)
    const before = await snapshot(db)
    const outboxBefore = await db.outbox.count()
    const b = clone((await roundtrip(db)).backup)
    // eine nicht speicherbare Funktion in der letzten Tabelle lässt die Transaktion scheitern
    b.data.goals[0] = { ...b.data.goals[0], kaputt: () => 1 } as never
    b.data.transactions = b.data.transactions.slice(1) // und etwas, das vorher bereits geschrieben worden wäre
    await expect(applyBackup(db, b)).rejects.toThrow()
    expect(await snapshot(db)).toEqual(before)
    expect(await db.outbox.count()).toBe(outboxBefore)
  })
})

describe('Prüfung der Datei', () => {
  const valid = async () => (await populate0()).backup
  async function populate0() {
    const db = fresh()
    await populate(db)
    return roundtrip(db)
  }
  const text = (b: unknown) => JSON.stringify(b)

  it('akzeptiert eine gültige Datei und ignoriert unbekannte Zusatzfelder', async () => {
    const b = clone(await valid())
    ;(b.data.persons[0] as Record<string, unknown>).extra = 'egal'
    const r = parseBackup(text(b))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.backup.data.persons[0]).not.toHaveProperty('extra')
  })

  it.each([
    ['kein JSON', 'das ist kein json', 'kein lesbares JSON'],
    [
      'anderes Programm',
      JSON.stringify({ app: 'etwas-anderes' }),
      'keine StudiBudget-Backup-Datei',
    ],
    ['Zahl statt Objekt', '42', 'keine StudiBudget-Backup-Datei'],
    ['null', 'null', 'keine StudiBudget-Backup-Datei'],
  ])('lehnt ab: %s', (_label, raw, msg) => {
    expect(errorOf(parseBackup(raw))).toContain(msg)
  })

  it('neuere Version wird als solche benannt', async () => {
    const b = clone(await valid())
    b.schemaVersion = 2
    expect(errorOf(parseBackup(text(b)))).toContain('neueren Version')
  })

  it('zu grosse Datei', () => {
    expect(errorOf(parseBackup('x'.repeat(21 * 1024 * 1024)))).toContain('zu gross')
  })

  const mutations: [string, (b: Backup) => void, string][] = [
    [
      'ID ist keine UUID (der Server würde sie ablehnen)',
      (b) => {
        b.data.persons[0].id = 'anna'
      },
      'persons',
    ],
    [
      'Monat ungültig',
      (b) => {
        b.data.budgets[0].validFrom = '2026-13'
      },
      'budgets',
    ],
    [
      'Datum ungültig',
      (b) => {
        b.data.transactions[0].date = '3.10.2026'
      },
      'transactions',
    ],
    [
      'negativer Betrag',
      (b) => {
        b.data.transactions[0].amountCents = -5
      },
      'transactions',
    ],
    [
      'Betrag mit Kommastellen',
      (b) => {
        b.data.transactions[0].amountCents = 12.5
      },
      'transactions',
    ],
    [
      'Betrag als Text',
      (b) => {
        b.data.transactions[0].amountCents = '90'
      },
      'transactions',
    ],
    [
      'Anteile ergeben nicht den Betrag',
      (b) => {
        ;(
          b.data.transactions.find((t) => t.shared)!.shared as { parts: { cents: number }[] }
        ).parts[0].cents += 1
      },
      'Anteile',
    ],
    [
      'unbekannte Art',
      (b) => {
        b.data.categories[0].type = 'sonstiges'
      },
      'categories',
    ],
    [
      'Notiz zu lang',
      (b) => {
        b.data.transactions[0].note = 'x'.repeat(201)
      },
      'transactions',
    ],
    [
      'Erinnerung ungültig',
      (b) => {
        b.data.settings[0].backupReminderDays = 5
      },
      'settings',
    ],
    [
      'Ampel verkehrt',
      (b) => {
        b.data.settings[0].ampel = { yellowPct: 100, redPct: 80 }
      },
      'settings',
    ],
    [
      'Tabelle fehlt',
      (b) => {
        delete (b.data as Partial<Backup['data']>).goals
      },
      'goals',
    ],
  ]
  it.each(mutations)('lehnt ab: %s', async (_label, mutate, hint) => {
    const b = clone(await valid())
    mutate(b)
    const r = parseBackup(text(b))
    expect(r.ok).toBe(false)
    expect(errorOf(r)).toContain('beschädigt')
    expect(errorOf(r)).toContain(hint)
  })

  const refs: [string, (b: Backup) => void, string][] = [
    [
      'Kategorie ohne Bereich',
      (b) => {
        b.data.categories[0].areaId = crypto.randomUUID()
      },
      'unbekannten Bereich',
    ],
    [
      'Budget ohne Kategorie',
      (b) => {
        b.data.budgets[0].categoryId = crypto.randomUUID()
      },
      'Budget',
    ],
    [
      'Buchung ohne Kategorie',
      (b) => {
        b.data.transactions[0].categoryId = crypto.randomUUID()
      },
      'Buchung verweist auf eine unbekannte Kategorie',
    ],
    [
      'Buchung mit unbekanntem Sparziel',
      (b) => {
        b.data.transactions.find((t) => t.goalId)!.goalId = crypto.randomUUID()
      },
      'Sparziel',
    ],
    [
      'gemeinsame Buchung mit unbekannter Person',
      (b) => {
        ;(b.data.transactions.find((t) => t.shared)!.shared as { paidBy: string }).paidBy =
          crypto.randomUUID()
      },
      'unbekannte Person',
    ],
    [
      'Ausgleichszahlung ohne Person',
      (b) => {
        b.data.settlements[0].personId = crypto.randomUUID()
      },
      'Ausgleichszahlung',
    ],
    [
      'Kontostand ohne Konto',
      (b) => {
        b.data.accountBalances[0].accountId = crypto.randomUUID()
      },
      'Kontostand',
    ],
    [
      'Vorlage ohne Kategorie',
      (b) => {
        b.data.templates[0].categoryId = crypto.randomUUID()
      },
      'Vorlage',
    ],
  ]
  it.each(refs)('lehnt ab: %s', async (_label, mutate, hint) => {
    const b = clone(await valid())
    mutate(b)
    const r = parseBackup(text(b))
    expect(errorOf(r)).toContain('beschädigt')
    expect(errorOf(r)).toContain(hint)
  })

  it('ohne Einstellungen oder bei nicht abgeschlossener Einrichtung', async () => {
    const none = clone(await valid())
    none.data.settings = []
    expect(errorOf(parseBackup(text(none)))).toContain('keine Einstellungen')
    const open = clone(await valid())
    ;(open.data.settings[0] as Record<string, unknown>).onboardingDone = false
    expect(errorOf(parseBackup(text(open)))).toContain('nicht abgeschlossenen Einrichtung')
  })
})
