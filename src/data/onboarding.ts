import type { StudiBudgetDB } from './db'
import { buildCatalogDrafts, defaultSettings, newId } from './seed'
import { createStore, type Store } from './store'
import { currentMonth, type MonthKey } from '../domain/period'
import type { Country, Living, Semester } from '../domain/types'

export interface OnboardingInput {
  country: Country
  living: Living
  hasCar: boolean
  /** Mein Anteil an gemeinsamen Kosten mit Partner/in, in Prozent. */
  partnerSharePct: number
  /** Mitbewohner/innen bzw. Partner/in (leer bei «allein» und «bei den Eltern»). */
  persons: string[]
  semesters: Semester[]
  /** Monatsbudget in Cent pro Katalogschlüssel; fehlende oder 0 werden nicht gespeichert. */
  budgets: Record<string, number>
}

/** Schliesst den Einrichtungsassistenten ab: legt Einstellungen, Personen, Kategorien und Budgets an. */
export async function completeOnboarding(
  db: StudiBudgetDB,
  input: OnboardingInput,
  month: MonthKey = currentMonth(),
  store: Store = createStore(db),
): Promise<void> {
  const settings = {
    ...defaultSettings(input.country, input.living, input.hasCar),
    myPartnerSharePct: input.partnerSharePct,
    semesters: input.semesters,
    onboardingDone: true,
  }
  const { areas, categories } = buildCatalogDrafts(input.country, input.living, input.hasCar)
  const budgets = categories
    .filter((c) => (input.budgets[c.catalogKey ?? ''] ?? 0) > 0)
    .map((c) => ({
      id: newId(),
      deleted: false,
      categoryId: c.id,
      validFrom: month,
      amountCents: input.budgets[c.catalogKey!],
    }))
  const persons = input.persons
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ id: newId(), deleted: false, name, active: true }))
  await store.putMany('areas', areas)
  await store.putMany('categories', categories)
  await store.putMany('persons', persons)
  await store.putMany('budgets', budgets)
  // Zuletzt: erst jetzt gilt die Einrichtung als abgeschlossen.
  await store.put('settings', settings)
}
