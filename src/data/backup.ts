import { z } from 'zod'
import type { StudiBudgetDB } from './db'
import { createStore, SYNCED_TABLES, type Store, type SyncedTable } from './store'

export const BACKUP_APP = 'studibudget'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024

const id = z.uuid()
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const cents = z.number().int().min(0).max(100_000_000_00)
const text = (max: number) => z.string().max(max)
const name = (max = 80) => z.string().trim().min(1).max(max)
const who = z.union([z.literal('me'), z.uuid()])
const common = { id, deleted: z.boolean().optional() }

const shared = z
  .object({
    paidBy: who,
    parts: z
      .array(z.object({ who, cents: z.number().int().min(0).max(100_000_000_00) }))
      .min(1)
      .max(50),
  })
  .optional()

const schemas = {
  settings: z.object({
    ...common,
    country: z.enum(['CH', 'DE']),
    living: z.enum(['allein', 'wg', 'partner', 'eltern']),
    hasCar: z.boolean(),
    myPartnerSharePct: z.number().min(0).max(100),
    semesters: z
      .array(
        z.object({
          name: name(60),
          startMonth: z.number().int().min(1).max(12),
          endMonth: z.number().int().min(1).max(12),
        }),
      )
      .min(1)
      .max(4),
    ampel: z
      .object({ yellowPct: z.number().gt(0).max(1000), redPct: z.number().gt(0).max(1000) })
      .refine((a) => a.redPct > a.yellowPct),
    theme: z.enum(['system', 'light', 'dark']),
    backupReminderDays: z.union([z.literal(0), z.literal(7), z.literal(14), z.literal(30)]),
    lastBackupAt: z.string().nullable(),
    onboardingDone: z.boolean(),
  }),
  persons: z.object({ ...common, name: name(60), active: z.boolean() }),
  areas: z.object({ ...common, name: name(60), order: z.number().int(), hidden: z.boolean() }),
  categories: z.object({
    ...common,
    areaId: id,
    name: name(),
    type: z.enum(['einnahme', 'ausgabe', 'sparen']),
    fix: z.boolean(),
    rolloverFrom: month.nullable(),
    hidden: z.boolean(),
    order: z.number().int(),
    catalogKey: z.string().max(40).optional(),
  }),
  budgets: z.object({ ...common, categoryId: id, validFrom: month, amountCents: cents }),
  transactions: z
    .object({
      ...common,
      date,
      categoryId: id,
      amountCents: cents,
      myAmountCents: cents,
      note: text(200),
      shared,
      templateId: id.optional(),
      templateMonth: month.optional(),
      goalId: id.optional(),
      goalDirection: z.enum(['einzahlung', 'entnahme']).optional(),
      carId: id.optional(),
    })
    .refine((t) => !t.shared || t.shared.parts.reduce((s, p) => s + p.cents, 0) === t.amountCents, {
      message: 'Die Anteile ergeben nicht den Gesamtbetrag',
    }),
  templates: z.object({
    ...common,
    categoryId: id,
    amountCents: cents,
    note: text(200),
    shared,
    months: z.array(z.number().int().min(1).max(12)).min(1).max(12),
    active: z.boolean(),
    noReserve: z.boolean().optional(),
    skipMonths: z.array(month).max(600).optional(),
    carId: id.optional(),
  }),
  settlements: z.object({
    ...common,
    date,
    personId: id,
    direction: z.enum(['ich_zahle', 'ich_erhalte']),
    amountCents: cents,
    note: text(200),
  }),
  accounts: z.object({
    ...common,
    name: name(60),
    kind: z.enum(['bank', 'spar', 'bargeld', 'schuld', 'depot']),
    include: z.boolean(),
    order: z.number().int(),
  }),
  accountBalances: z.object({
    ...common,
    accountId: id,
    month,
    amountCents: z.number().int().min(-100_000_000_00).max(100_000_000_00),
  }),
  goals: z.object({
    ...common,
    name: name(60),
    targetCents: cents,
    targetDate: date.nullable(),
    startCents: cents,
    archived: z.boolean(),
  }),
  cars: z.object({ ...common, name: name(60), archived: z.boolean(), order: z.number().int() }),
} satisfies Record<SyncedTable, z.ZodType>

const fileSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  data: z.object(
    Object.fromEntries(
      SYNCED_TABLES.map((t) => [
        t,
        // Backups aus älteren Versionen kennen «cars» noch nicht.
        t === 'cars'
          ? z.array(schemas[t]).max(200_000).default([])
          : z.array(schemas[t]).max(200_000),
      ]),
    ) as unknown as {
      [K in SyncedTable]: z.ZodArray<(typeof schemas)[K]>
    },
  ),
})

type Rec = { id: string; deleted?: boolean; [k: string]: unknown }
export interface Backup {
  app: typeof BACKUP_APP
  schemaVersion: number
  exportedAt: string
  data: Record<SyncedTable, Rec[]>
}

/** Alle (nicht gelöschten) Daten als Backup-Objekt; die Zeitstempel für den Sync bleiben bewusst draussen. */
export async function exportBackup(db: StudiBudgetDB, now: Date = new Date()): Promise<Backup> {
  const data = {} as Record<SyncedTable, Rec[]>
  for (const t of SYNCED_TABLES) {
    data[t] = (await db.table(t).toArray())
      .filter((r) => !r.deleted)
      .map(({ updatedAt: _u, deleted: _d, ...rest }) => rest as Rec)
  }
  return { app: BACKUP_APP, schemaVersion: BACKUP_VERSION, exportedAt: now.toISOString(), data }
}

export const backupFileName = (now: Date = new Date()) =>
  `studibudget-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`

export type ParseResult =
  { ok: true; backup: Backup; counts: Record<SyncedTable, number> } | { ok: false; error: string }

const fail = (error: string): ParseResult => ({ ok: false, error })

/** Verweise zwischen den Tabellen müssen aufgehen, sonst ist die Datei beschädigt oder von Hand verändert. */
function checkReferences(d: Backup['data']): string | null {
  const ids = (t: SyncedTable) => new Set(d[t].map((r) => r.id))
  const [areas, cats, persons, accounts, goals, cars] = [
    ids('areas'),
    ids('categories'),
    ids('persons'),
    ids('accounts'),
    ids('goals'),
    ids('cars'),
  ]
  const person = (w: unknown) => w === 'me' || persons.has(w as string)
  for (const c of d.categories)
    if (!areas.has(c.areaId as string))
      return `Eine Kategorie verweist auf einen unbekannten Bereich («${c.name}»).`
  for (const b of d.budgets)
    if (!cats.has(b.categoryId as string))
      return 'Ein Budget verweist auf eine unbekannte Kategorie.'
  for (const t of d.transactions) {
    if (!cats.has(t.categoryId as string))
      return 'Eine Buchung verweist auf eine unbekannte Kategorie.'
    if (t.carId && !cars.has(t.carId as string))
      return 'Eine Buchung verweist auf ein unbekanntes Auto.'
    if (t.goalId && !goals.has(t.goalId as string))
      return 'Eine Buchung verweist auf ein unbekanntes Sparziel.'
    const sh = t.shared as { paidBy: string; parts: { who: string }[] } | undefined
    if (sh && !(person(sh.paidBy) && sh.parts.every((p) => person(p.who))))
      return 'Eine gemeinsame Buchung verweist auf eine unbekannte Person.'
  }
  for (const t of d.templates)
    if (!cats.has(t.categoryId as string))
      return 'Eine Vorlage verweist auf eine unbekannte Kategorie.'
  for (const t of d.templates)
    if (t.carId && !cars.has(t.carId as string))
      return 'Eine Vorlage verweist auf ein unbekanntes Auto.'
  for (const s of d.settlements)
    if (!persons.has(s.personId as string))
      return 'Eine Ausgleichszahlung verweist auf eine unbekannte Person.'
  for (const b of d.accountBalances)
    if (!accounts.has(b.accountId as string))
      return 'Ein Kontostand verweist auf ein unbekanntes Konto.'
  return null
}

/** Liest und prüft den Inhalt einer Backup-Datei. Es wird nichts gespeichert. */
export function parseBackup(raw: string): ParseResult {
  if (raw.length > MAX_BACKUP_BYTES)
    return fail('Die Datei ist zu gross für ein StudiBudget-Backup.')
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return fail('Das ist keine gültige Backup-Datei (kein lesbares JSON).')
  }
  const head = json as { app?: unknown; schemaVersion?: unknown }
  if (!head || typeof head !== 'object' || head.app !== BACKUP_APP)
    return fail('Das ist keine StudiBudget-Backup-Datei.')
  if (typeof head.schemaVersion === 'number' && head.schemaVersion > BACKUP_VERSION)
    return fail(
      'Dieses Backup stammt von einer neueren Version von StudiBudget. Bitte aktualisiere die App.',
    )
  const parsed = fileSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return fail(
      `Die Backup-Datei ist beschädigt: ${issue.path.join('.') || 'Aufbau'} (${issue.message}).`,
    )
  }
  const backup = parsed.data as unknown as Backup
  if (backup.data.settings.length !== 1) return fail('Das Backup enthält keine Einstellungen.')
  if (backup.data.settings[0].onboardingDone !== true)
    return fail('Dieses Backup stammt aus einer nicht abgeschlossenen Einrichtung.')
  const ref = checkReferences(backup.data)
  if (ref) return fail(`Die Backup-Datei ist beschädigt: ${ref}`)
  const counts = Object.fromEntries(SYNCED_TABLES.map((t) => [t, backup.data[t].length])) as Record<
    SyncedTable,
    number
  >
  return { ok: true, backup, counts }
}

/**
 * Ersetzt alle Daten durch das Backup, in einem Schritt (ganz oder gar nicht). Was nicht im Backup steht, wird als gelöscht
 * markiert und kommt so auch auf die anderen Geräte; alles Übernommene wird neu gestempelt und synchronisiert.
 */
export async function applyBackup(
  db: StudiBudgetDB,
  backup: Backup,
  store: Store = createStore(db),
): Promise<void> {
  const entries: { name: SyncedTable; drafts: object[] }[] = []
  for (const t of SYNCED_TABLES) {
    const incoming = backup.data[t]
      .filter((r) => !r.deleted)
      .map(({ deleted: _d, ...r }) => ({ ...r, deleted: false }))
    const keep = new Set(incoming.map((r) => r.id))
    const gone = (await db.table(t).toArray())
      .filter((r) => !r.deleted && !keep.has(r.id))
      .map(({ updatedAt: _u, ...r }) => ({ ...r, deleted: true }))
    entries.push({ name: t, drafts: [...incoming, ...gone] })
  }
  await store.writeBatch(entries)
}
