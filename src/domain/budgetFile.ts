import type { Budget, Category, CategoryType } from './types'

export const BUDGET_FILE_KIND = 'budget'
export const BUDGET_FILE_VERSION = 1
export const MAX_BUDGET_FILE_BYTES = 1024 * 1024

export interface BudgetFileItem {
  name: string
  type: CategoryType
  validFrom: string
  amountCents: number
}

export interface BudgetFile {
  app: 'studibudget'
  kind: typeof BUDGET_FILE_KIND
  schemaVersion: number
  exportedAt: string
  items: BudgetFileItem[]
}

const TYPES: CategoryType[] = ['einnahme', 'ausgabe', 'sparen']
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** Budgetwerte mit dem Namen der Kategorie: IDs gelten nur im eigenen Konto, Namen auch in einem neuen. */
export function exportBudgetFile(
  categories: Category[],
  budgets: Budget[],
  now: Date = new Date(),
): BudgetFile {
  const byId = new Map(categories.filter((c) => !c.deleted).map((c) => [c.id, c]))
  const items: BudgetFileItem[] = []
  for (const b of budgets) {
    const c = byId.get(b.categoryId)
    if (b.deleted || !c) continue
    items.push({ name: c.name, type: c.type, validFrom: b.validFrom, amountCents: b.amountCents })
  }
  items.sort((a, b) => a.name.localeCompare(b.name) || a.validFrom.localeCompare(b.validFrom))
  return {
    app: 'studibudget',
    kind: BUDGET_FILE_KIND,
    schemaVersion: BUDGET_FILE_VERSION,
    exportedAt: now.toISOString(),
    items,
  }
}

export type BudgetParseResult = { ok: true; items: BudgetFileItem[] } | { ok: false; error: string }

export function parseBudgetFile(raw: string): BudgetParseResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' }
  }
  const f = data as Partial<BudgetFile> | null
  if (!f || typeof f !== 'object' || f.app !== 'studibudget' || f.kind !== BUDGET_FILE_KIND)
    return { ok: false, error: 'Das ist keine Budget-Datei von StudiBudget.' }
  if (f.schemaVersion !== BUDGET_FILE_VERSION)
    return { ok: false, error: 'Diese Version der Budget-Datei wird nicht unterstützt.' }
  if (!Array.isArray(f.items)) return { ok: false, error: 'Die Datei enthält keine Budgetwerte.' }
  const items: BudgetFileItem[] = []
  for (const [i, it] of (f.items as unknown[]).entries()) {
    const x = it as Partial<BudgetFileItem> | null
    const ok =
      !!x &&
      typeof x.name === 'string' &&
      x.name.trim() !== '' &&
      TYPES.includes(x.type as CategoryType) &&
      typeof x.validFrom === 'string' &&
      MONTH.test(x.validFrom) &&
      typeof x.amountCents === 'number' &&
      Number.isSafeInteger(x.amountCents) &&
      x.amountCents >= 0
    if (!ok) return { ok: false, error: `Eintrag ${i + 1} ist ungültig.` }
    items.push({
      name: x.name!.trim(),
      type: x.type!,
      validFrom: x.validFrom!,
      amountCents: x.amountCents!,
    })
  }
  return { ok: true, items }
}

export interface BudgetImportPlan {
  /** Werte, deren Kategorie (gleicher Name und gleiche Art) es gibt. */
  matched: { categoryId: string; validFrom: string; amountCents: number }[]
  /** Namen der Kategorien, die es hier nicht gibt; ihre Werte werden nicht übernommen. */
  skipped: string[]
}

export function planBudgetImport(
  items: BudgetFileItem[],
  categories: Category[],
): BudgetImportPlan {
  const key = (name: string, type: CategoryType) => `${type}|${name.trim().toLocaleLowerCase('de')}`
  const byKey = new Map<string, Category>()
  for (const c of categories) if (!c.deleted) byKey.set(key(c.name, c.type), c)
  const matched: BudgetImportPlan['matched'] = []
  const skipped = new Set<string>()
  for (const it of items) {
    const c = byKey.get(key(it.name, it.type))
    if (c) matched.push({ categoryId: c.id, validFrom: it.validFrom, amountCents: it.amountCents })
    else skipped.add(it.name)
  }
  return { matched, skipped: [...skipped].sort() }
}
