import type {
  Account,
  AccountBalance,
  Budget,
  Goal,
  Settlement,
  Template,
  Transaction,
} from './types'

/** Was sich zurücksetzen lässt. Konto, Kategorien, Personen, Autos und Einstellungen bleiben immer. */
export type ResetKind =
  | 'budgets'
  | 'transactions'
  | 'templates'
  | 'settlements'
  | 'accounts'
  | 'accountBalances'
  | 'goals'

export const RESET_KINDS: { kind: ResetKind; label: string }[] = [
  { kind: 'budgets', label: 'Budget (Monatsbudgets)' },
  { kind: 'transactions', label: 'Buchungen' },
  { kind: 'templates', label: 'Fixkosten-Vorlagen' },
  { kind: 'settlements', label: 'Ausgleichszahlungen' },
  { kind: 'accounts', label: 'Konten' },
  { kind: 'accountBalances', label: 'Kontostände' },
  { kind: 'goals', label: 'Sparziele' },
]

export interface ResetData {
  budgets: Budget[]
  transactions: Transaction[]
  templates: Template[]
  settlements: Settlement[]
  accounts: Account[]
  accountBalances: AccountBalance[]
  goals: Goal[]
}

export interface ResetPlan {
  /** Tatsächlich betroffene Arten (Konten ziehen ihre Stände mit). */
  selection: Set<ResetKind>
  /** Anzahl gelöschter Einträge pro Art. */
  counts: Record<ResetKind, number>
  total: number
  /** Buchungen, die bleiben, aber ihren Verweis auf eine gelöschte Vorlage verlieren. */
  detachedFromTemplates: number
  /** Buchungen, die bleiben, aber ihren Verweis auf ein gelöschtes Sparziel verlieren. */
  detachedFromGoals: number
  /** Für `store.writeBatch`: zuerst die bereinigten Buchungen, dann die Grabsteine. */
  writes: { name: ResetKind; drafts: object[] }[]
}

/** Ohne ihr Konto sind Kontostände sinnlos (und die Backup-Prüfung lehnt sie ab): Konten ziehen ihre Stände mit. */
export function effectiveSelection(selected: Iterable<ResetKind>): Set<ResetKind> {
  const s = new Set(selected)
  if (s.has('accounts')) s.add('accountBalances')
  return s
}

export function planReset(data: ResetData, selected: Iterable<ResetKind>): ResetPlan {
  const selection = effectiveSelection(selected)
  const live = <T extends { deleted: boolean }>(rows: T[]) => rows.filter((r) => !r.deleted)
  const counts = {} as Record<ResetKind, number>
  const writes: ResetPlan['writes'] = []

  let detachedFromTemplates = 0
  let detachedFromGoals = 0
  if (!selection.has('transactions')) {
    const dropTemplates = selection.has('templates')
    const dropGoals = selection.has('goals')
    const cleaned: Transaction[] = []
    for (const t of live(data.transactions)) {
      const fromTemplate = dropTemplates && t.templateId !== undefined
      const fromGoal = dropGoals && t.goalId !== undefined
      if (!fromTemplate && !fromGoal) continue
      const next = { ...t }
      if (fromTemplate) {
        delete next.templateId
        delete next.templateMonth
        detachedFromTemplates++
      }
      if (fromGoal) {
        delete next.goalId
        delete next.goalDirection
        detachedFromGoals++
      }
      cleaned.push(next)
    }
    if (cleaned.length > 0) writes.push({ name: 'transactions', drafts: cleaned })
  }

  for (const { kind } of RESET_KINDS) {
    const rows = live(data[kind] as { deleted: boolean }[])
    counts[kind] = selection.has(kind) ? rows.length : 0
    if (selection.has(kind) && rows.length > 0)
      writes.push({ name: kind, drafts: rows.map((r) => ({ ...r, deleted: true })) })
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { selection, counts, total, detachedFromTemplates, detachedFromGoals, writes }
}
