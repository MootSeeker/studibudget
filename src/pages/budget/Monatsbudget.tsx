import { useState } from 'react'
import { inputClass } from '../../auth/ui'
import { Collapsible } from '../../components/Collapsible'
import { DraftInput } from '../../components/DraftInput'
import { ReserveHint } from '../../components/ReserveHint'
import type { useBudgets, useTemplates } from '../../data/hooks'
import { budgetForMonth } from '../../domain/budget'
import { summarizeBudget } from '../../domain/budgetPlan'
import { formatMoney, parseAmount } from '../../domain/money'
import type { Area, Category, Country } from '../../domain/types'
import { MONTH_NAMES } from '../../lib/months'
import { addMonths } from '../../domain/period'
import { useOpenSet } from '../../lib/useOpenSet'
import { groupByArea, plural } from './shared'

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

function AmountRow({
  cat,
  amount,
  month,
  setBudget,
}: {
  cat: Category
  amount: number
  month: string
  setBudget: (cat: Category, value: string) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  return (
    <li className="space-y-1 px-4 py-2">
      <div className="grid grid-cols-[1fr_9rem] items-center gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cat.hidden ? 'opacity-60' : ''}>{cat.name}</span>
          {cat.fix && <span className="rounded bg-border px-2 py-0.5 text-xs">Fix</span>}
          {cat.rolloverFrom !== null && (
            <span className="rounded bg-border px-2 py-0.5 text-xs">Rest wird übertragen</span>
          )}
        </span>
        <DraftInput
          key={`${cat.id}-${month}`}
          aria-label={`Monatsbudget ${cat.name}`}
          className={`${inputClass} text-right`}
          inputMode="decimal"
          placeholder="0.00"
          value={amount > 0 ? (amount / 100).toFixed(2) : ''}
          onCommit={async (text) => {
            if (parseAmount(text || '0') === amount) {
              setError(null)
              return false
            }
            try {
              await setBudget(cat, text)
              setError(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Ungültiger Betrag.')
              throw err
            }
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  )
}

export function Monatsbudget({
  country,
  month,
  setMonth,
  areas,
  categories,
  budgets,
  templates,
  setBudget,
}: {
  country: Country
  month: string
  setMonth: (m: string) => void
  areas: Area[]
  categories: Category[]
  budgets: ReturnType<typeof useBudgets>
  templates: ReturnType<typeof useTemplates>
  setBudget: (cat: Category, value: string) => Promise<void>
}) {
  const money = (c: number) => formatMoney(c, country)
  const label = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
  const groups = groupByArea(areas, categories, false).filter((g) => g.visible.length > 0)
  const open = useOpenSet(
    'studibudget:budget-monat-offen',
    groups.map((g) => g.area.id),
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Lege pro Kategorie fest, wie viel du im Monat einnehmen, ausgeben oder sparen willst. Eine
        Änderung gilt ab dem gewählten Monat; frühere Monate behalten ihren Wert.
      </p>

      <div className="flex items-center justify-between">
        <button
          className="min-h-11 min-w-11 rounded-md border border-border px-3 py-2"
          aria-label="Vorheriger Monat"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          ◀
        </button>
        <h2 className="text-lg font-semibold" aria-live="polite">
          Gilt ab {label}
        </h2>
        <button
          className="min-h-11 min-w-11 rounded-md border border-border px-3 py-2"
          aria-label="Nächster Monat"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ▶
        </button>
      </div>

      <Summary country={country} month={month} categories={categories} budgets={budgets} />

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-3 py-2"
          onClick={() => open.setAll(true)}
        >
          Alle aufklappen
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-3 py-2"
          onClick={() => open.setAll(false)}
        >
          Alle zuklappen
        </button>
      </div>

      <div className="space-y-3">
        {groups.map(({ area, visible }) => {
          const sum = visible.reduce((s, c) => s + budgetForMonth(budgets, c.id, month), 0)
          return (
            <Collapsible
              key={area.id}
              headingLevel={3}
              title={area.name}
              summary={`${plural(visible.length, 'Kategorie', 'Kategorien')} · ${money(sum)}`}
              open={open.isOpen(area.id)}
              onToggle={() => open.toggle(area.id)}
            >
              <ul className="divide-y divide-border">
                {visible.map((cat) => (
                  <AmountRow
                    key={cat.id}
                    cat={cat}
                    amount={budgetForMonth(budgets, cat.id, month)}
                    month={month}
                    setBudget={setBudget}
                  />
                ))}
              </ul>
            </Collapsible>
          )
        })}
      </div>

      <ReserveHint templates={templates} categories={categories} country={country} month={month} />
    </div>
  )
}
