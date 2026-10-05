import { useState } from 'react'
import { BudgetFileSection } from '../components/BudgetFileSection'
import { SubNav } from '../components/SubNav'
import { useSubNav, type SubNavItem } from '../lib/useSubNav'
import { TemplatesPanel } from '../components/TemplatesPanel'
import { db } from '../data/db'
import {
  useAllCars,
  useAreas,
  useBudgets,
  useCategories,
  useSettings,
  useTemplates,
} from '../data/hooks'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { budgetDraftFor } from '../domain/budgetPlan'
import { parseAmount } from '../domain/money'
import { currentMonth } from '../domain/period'
import type { Category } from '../domain/types'
import { Kategorien } from './budget/Kategorien'
import { Monatsbudget } from './budget/Monatsbudget'

const TABS: SubNavItem[] = [
  { id: 'monat', label: 'Monatsbudget' },
  { id: 'kategorien', label: 'Kategorien' },
  { id: 'fixkosten', label: 'Fixkosten' },
  { id: 'datei', label: 'Datei' },
]

export function Budget() {
  const settings = useSettings()
  const categories = useCategories()
  const areas = useAreas()
  const budgets = useBudgets()
  const templates = useTemplates()
  const cars = useAllCars()
  const [month, setMonth] = useState(currentMonth())
  const [error, setError] = useState<string | null>(null)
  const tab = useSubNav('ansicht', TABS)

  if (!settings) return null

  function run(fn: () => Promise<void>) {
    setError(null)
    fn().catch((e) => setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.'))
  }

  async function setBudget(cat: Category, value: string) {
    const cents = value.trim() === '' ? 0 : parseAmount(value)
    if (cents === null || cents < 0) throw new Error('Bitte gib einen gültigen Betrag ein.')
    // Den vorhandenen Eintrag des Monats frisch aus der Datenbank suchen: Der Bildschirmzustand kann hinterherhinken, und
    // dann entstünde bei zwei raschen Änderungen ein zweiter Eintrag für denselben Monat.
    const fresh = (await db.budgets.toArray()).filter((b) => !b.deleted)
    await store.put('budgets', budgetDraftFor(fresh, cat.id, month, cents, newId))
  }

  return (
    <section className="max-w-3xl space-y-6 xl:max-w-5xl">
      <h1 className="text-2xl font-semibold">Budget</h1>
      <SubNav param="ansicht" items={TABS} label="Budget-Ansichten" />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {tab === 'monat' && (
        <Monatsbudget
          country={settings.country}
          month={month}
          setMonth={setMonth}
          areas={areas}
          categories={categories}
          budgets={budgets}
          templates={templates}
          setBudget={setBudget}
        />
      )}
      {tab === 'kategorien' && (
        <Kategorien month={month} areas={areas} categories={categories} run={run} />
      )}
      {tab === 'fixkosten' && (
        <TemplatesPanel
          cars={cars}
          templates={templates}
          categories={categories}
          country={settings.country}
        />
      )}
      {tab === 'datei' && <BudgetFileSection categories={categories} budgets={budgets} />}
    </section>
  )
}
