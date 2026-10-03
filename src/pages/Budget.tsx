import { useState } from 'react'
import { buttonClass, inputClass } from '../auth/ui'
import { MONTH_NAMES } from '../components/MonthSelect'
import { TemplatesPanel } from '../components/TemplatesPanel'
import { createCategoryOps } from '../data/categoryOps'
import { db } from '../data/db'
import { useAreas, useBudgets, useCategories, useSettings, useTemplates } from '../data/hooks'
import { newId } from '../data/seed'
import { store } from '../data/store'
import { budgetForMonth } from '../domain/budget'
import { budgetDraftFor, summarizeBudget } from '../domain/budgetPlan'
import { formatMoney, parseAmount } from '../domain/money'
import { addMonths, currentMonth } from '../domain/period'
import type { Area, Category, CategoryType, Country } from '../domain/types'

const ops = createCategoryOps(db)
const TYPE_LABEL: Record<CategoryType, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  sparen: 'Sparen',
}

interface RowProps {
  cat: Category
  areas: Area[]
  amount: number
  month: string
  canUp: boolean
  canDown: boolean
  run: (fn: () => Promise<void>) => void
  setBudget: (cat: Category, value: string) => Promise<void>
}

function CategoryRow({ cat, areas, amount, month, canUp, canDown, run, setBudget }: RowProps) {
  const [budgetError, setBudgetError] = useState<string | null>(null)
  return (
    <li className={`space-y-2 px-4 py-3 ${cat.hidden ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-[1fr_9rem] items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            aria-label={`Name ${cat.name}`}
            className={inputClass}
            defaultValue={cat.name}
            key={cat.name}
            onBlur={(e) =>
              e.target.value.trim() !== cat.name &&
              run(() => ops.updateCategory(cat, { name: e.target.value }))
            }
          />
          <span className="whitespace-nowrap rounded bg-border px-2 py-0.5 text-xs">
            {TYPE_LABEL[cat.type]}
          </span>
        </div>
        <input
          aria-label={`Monatsbudget ${cat.name}`}
          className={`${inputClass} text-right`}
          inputMode="decimal"
          placeholder="0.00"
          defaultValue={amount > 0 ? (amount / 100).toFixed(2) : ''}
          key={`${cat.id}-${month}-${amount}`}
          onBlur={async (e) => {
            const value = e.target.value
            if (parseAmount(value || '0') === amount) return setBudgetError(null)
            try {
              await setBudget(cat, value)
              setBudgetError(null)
            } catch (err) {
              setBudgetError(err instanceof Error ? err.message : 'Ungültiger Betrag.')
            }
          }}
        />
      </div>
      {budgetError && (
        <p role="alert" className="text-sm text-red-600">
          {budgetError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {cat.type === 'ausgabe' && (
          <>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={cat.fix}
                onChange={(e) => run(() => ops.updateCategory(cat, { fix: e.target.checked }))}
              />
              Fixkosten
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={cat.rolloverFrom !== null}
                onChange={(e) =>
                  run(() =>
                    ops.updateCategory(cat, { rolloverFrom: e.target.checked ? month : null }),
                  )
                }
              />
              Rest übertragen{cat.rolloverFrom ? ` (ab ${cat.rolloverFrom})` : ''}
            </label>
          </>
        )}
        <label className="flex items-center gap-1">
          Bereich
          <select
            aria-label={`Bereich ${cat.name}`}
            className="rounded-md border border-border bg-surface px-2 py-1"
            value={cat.areaId}
            onChange={(e) => run(() => ops.updateCategory(cat, { areaId: e.target.value }))}
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded border border-border px-2 py-1 disabled:opacity-30"
          disabled={!canUp}
          aria-label={`${cat.name} nach oben`}
          onClick={() => run(() => ops.move(cat, -1))}
        >
          ↑
        </button>
        <button
          className="rounded border border-border px-2 py-1 disabled:opacity-30"
          disabled={!canDown}
          aria-label={`${cat.name} nach unten`}
          onClick={() => run(() => ops.move(cat, 1))}
        >
          ↓
        </button>
        <button
          className="text-accent underline"
          onClick={() => run(() => ops.updateCategory(cat, { hidden: !cat.hidden }))}
        >
          {cat.hidden ? 'Einblenden' : 'Ausblenden'}
        </button>
      </div>
    </li>
  )
}

function AddCategory({ area, run }: { area: Area; run: (fn: () => Promise<void>) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('ausgabe')
  return (
    <form
      className="flex flex-wrap gap-2 border-t border-border px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          await ops.addCategory(area.id, name, type)
          setName('')
        })
      }}
    >
      <input
        aria-label={`Neue Kategorie in ${area.name}`}
        className={`${inputClass} flex-1`}
        placeholder="Neue Kategorie"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        aria-label={`Art der neuen Kategorie in ${area.name}`}
        className="rounded-md border border-border bg-surface px-2 py-2"
        value={type}
        onChange={(e) => setType(e.target.value as CategoryType)}
      >
        {Object.entries(TYPE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <button className={buttonClass} type="submit">
        Hinzufügen
      </button>
    </form>
  )
}

function Summary({
  country,
  month,
  categories,
  budgets,
}: {
  country: Country
  month: string
  categories: Category[]
  budgets: ReturnType<typeof useBudgets>
}) {
  const s = summarizeBudget(categories, budgets, month)
  const money = (c: number) => formatMoney(c, country)
  const items: [string, number][] = [
    ['Einnahmen', s.einnahmen],
    ['Ausgaben', s.ausgaben],
    ['Sparen', s.sparen],
    ['Bleibt übrig', s.saldo],
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border bg-surface p-2">
          <dt className="text-muted">{label}</dt>
          <dd
            className={`font-semibold ${label === 'Bleibt übrig' && value < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
          >
            {money(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Budget() {
  const settings = useSettings()
  const categories = useCategories()
  const areas = useAreas()
  const budgets = useBudgets()
  const templates = useTemplates()
  const [month, setMonth] = useState(currentMonth())
  const [showHidden, setShowHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newArea, setNewArea] = useState('')

  if (!settings) return null

  function run(fn: () => Promise<void>) {
    setError(null)
    fn().catch((e) => setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.'))
  }

  async function setBudget(cat: Category, value: string) {
    const cents = value.trim() === '' ? 0 : parseAmount(value)
    if (cents === null || cents < 0) throw new Error('Bitte gib einen gültigen Betrag ein.')
    await store.put('budgets', budgetDraftFor(budgets, cat.id, month, cents, newId))
  }

  const label = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

  return (
    <section className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Budget</h1>
      <p className="text-sm text-muted">
        Lege pro Kategorie fest, wie viel du im Monat einnehmen, ausgeben oder sparen willst. Eine
        Änderung gilt ab dem gewählten Monat; frühere Monate behalten ihren Wert.
      </p>

      <div className="flex items-center justify-between">
        <button
          className="rounded-md border border-border px-3 py-2"
          aria-label="Vorheriger Monat"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          ◀
        </button>
        <h2 className="text-lg font-semibold" aria-live="polite">
          Gilt ab {label}
        </h2>
        <button
          className="rounded-md border border-border px-3 py-2"
          aria-label="Nächster Monat"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ▶
        </button>
      </div>

      <Summary country={settings.country} month={month} categories={categories} budgets={budgets} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showHidden}
          onChange={(e) => setShowHidden(e.target.checked)}
        />
        Ausgeblendete Kategorien anzeigen
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {areas.map((area) => {
        const all = categories.filter((c) => c.areaId === area.id).sort((a, b) => a.order - b.order)
        const visible = all.filter((c) => showHidden || !c.hidden)
        return (
          <div key={area.id} className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <input
                aria-label={`Bereich umbenennen ${area.name}`}
                className="w-full bg-transparent text-lg font-semibold outline-none focus:ring-2 focus:ring-accent/30"
                defaultValue={area.name}
                key={area.name}
                onBlur={(e) =>
                  e.target.value.trim() !== area.name &&
                  run(() => ops.renameArea(area, e.target.value))
                }
              />
            </div>
            <ul className="divide-y divide-border">
              {visible.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  areas={areas}
                  amount={budgetForMonth(budgets, cat.id, month)}
                  month={month}
                  canUp={all.indexOf(cat) > 0}
                  canDown={all.indexOf(cat) < all.length - 1}
                  run={run}
                  setBudget={setBudget}
                />
              ))}
              {visible.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted">Keine Kategorien.</li>
              )}
            </ul>
            <AddCategory area={area} run={run} />
          </div>
        )
      })}

      <form
        className="flex gap-2 rounded-xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            await ops.addArea(newArea)
            setNewArea('')
          })
        }}
      >
        <input
          aria-label="Neuer Bereich"
          className={`${inputClass} flex-1`}
          placeholder="Neuer Bereich, z. B. Haustier"
          value={newArea}
          onChange={(e) => setNewArea(e.target.value)}
        />
        <button className={buttonClass} type="submit">
          Bereich anlegen
        </button>
      </form>

      <TemplatesPanel templates={templates} categories={categories} country={settings.country} />
    </section>
  )
}
