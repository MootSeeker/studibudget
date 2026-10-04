import { ReserveHint } from '../components/ReserveHint'
import { useState } from 'react'
import { MONTH_NAMES } from '../components/MonthSelect'
import {
  useAllCars,
  useAllTransactions,
  useAreas,
  useBudgets,
  useCategories,
  useSettings,
  useTemplates,
} from '../data/hooks'
import { formatMoney } from '../domain/money'
import { addMonths, currentMonth, monthOf } from '../domain/period'
import { buildMonthView, type Compare, type RowView, type Triple } from '../domain/monthView'
import type { Ampel } from '../domain/month'
import type { Country } from '../domain/types'

const STATUS: Record<Ampel, { text: string; color: string; bar: string }> = {
  gruen: { text: 'Im Rahmen', color: 'text-ok', bar: 'bg-ok' },
  gelb: { text: 'Knapp', color: 'text-warn', bar: 'bg-warn' },
  rot: { text: 'Überschritten', color: 'text-bad', bar: 'bg-bad' },
}

function Bar({ pct, className, label }: { pct: number; className: string; label: string }) {
  const width = Math.max(0, Math.min(100, pct))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="h-2 w-full overflow-hidden rounded bg-border"
    >
      <div className={`h-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  )
}

function Row({ row, money }: { row: RowView; money: (c: number) => string }) {
  const { category: c } = row
  const isExpense = c.type === 'ausgabe'
  const status = row.ampel && !row.ampel.noBudget ? STATUS[row.ampel.status] : null
  const label = isExpense
    ? row.ampel?.noBudget
      ? 'Ohne Budget'
      : row.ampel?.status === 'rot' && row.remaining >= 0
        ? 'Ausgeschöpft'
        : (status?.text ?? '')
    : row.available > 0
      ? `${Math.round(row.pct ?? 0)} %`
      : ''
  return (
    <li className="space-y-1 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{c.name}</span>
        <span className="text-sm tabular-nums">
          {money(row.actual)}
          {row.available > 0 && <span className="text-muted"> von {money(row.available)}</span>}
        </span>
      </div>
      {(row.available > 0 || row.ampel) && (
        <Bar
          label={`${c.name} ausgeschöpft`}
          pct={row.pct ?? (row.actual > 0 ? 100 : 0)}
          className={
            isExpense ? (row.ampel?.noBudget ? 'bg-bad' : (status?.bar ?? 'bg-ok')) : 'bg-accent'
          }
        />
      )}
      <div className="flex justify-between text-sm">
        <span
          className={isExpense ? (row.ampel?.noBudget ? 'text-bad' : status?.color) : 'text-muted'}
        >
          {label}
        </span>
        <span className="text-muted">
          {isExpense &&
            row.available > 0 &&
            (row.remaining >= 0
              ? `Noch ${money(row.remaining)}`
              : `${money(-row.remaining)} drüber`)}
          {isExpense && row.rollover !== 0 && ` · Übertrag ${money(row.rollover)}`}
        </span>
      </div>
    </li>
  )
}

function Delta({
  current,
  reference,
  money,
  label,
}: {
  current: number
  reference: number | null
  money: (c: number) => string
  label: string
}) {
  if (reference === null) return <p className="text-sm text-muted">{label}: keine Daten</p>
  const diff = current - reference
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : ''
  return (
    <p className="text-sm">
      <span className="text-muted">{label}:</span> {money(reference)}{' '}
      <span className="text-muted">
        ({sign}
        {money(Math.abs(diff))})
      </span>
    </p>
  )
}

function CompareCard({
  title,
  c,
  money,
}: {
  title: string
  c: Compare
  money: (c: number) => string
}) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-surface p-3">
      <h3 className="font-medium">{title}</h3>
      <p className="text-lg font-semibold tabular-nums">{money(c.current)}</p>
      <Delta current={c.current} reference={c.prev} money={money} label="Vormonat" />
      <Delta current={c.current} reference={c.avg3} money={money} label="Ø letzte 3 Monate" />
    </div>
  )
}

export function Monat() {
  const settings = useSettings()
  const categories = useCategories()
  const areas = useAreas()
  const budgets = useBudgets()
  const templates = useTemplates()
  const cars = useAllCars()
  const txs = useAllTransactions()
  const [month, setMonth] = useState(currentMonth())

  if (!settings) return null
  const country: Country = settings.country
  const money = (c: number) => formatMoney(c, country)
  const now = new Date()
  const view = buildMonthView({
    month,
    today: { month: currentMonth(now), day: now.getDate() },
    categories,
    areas,
    budgets,
    txs,
    templates,
    ampel: settings.ampel,
  })
  const label = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt'
  const monthTxs = txs
    .filter((t) => monthOf(t.date) === month)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))

  const table: [string, Triple][] = [
    ['Einnahmen', view.einnahmen],
    ['Ausgaben', view.ausgaben],
    ['Sparen', view.sparen],
    ['Saldo', view.saldo],
  ]
  const forecastLabel = view.phase === 'past' ? 'Ergebnis' : 'Prognose'

  return (
    <section className="max-w-3xl space-y-6 xl:max-w-5xl">
      <h1 className="text-2xl font-semibold">Monat</h1>

      <div className="flex items-center justify-between">
        <button
          className="min-h-11 min-w-11 rounded-md border border-border px-3 py-2"
          aria-label="Vorheriger Monat"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          ◀
        </button>
        <h2 className="text-lg font-semibold" aria-live="polite">
          {label}
        </h2>
        <button
          className="min-h-11 min-w-11 rounded-md border border-border px-3 py-2"
          aria-label="Nächster Monat"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ▶
        </button>
      </div>

      <ReserveHint
        compact
        templates={templates}
        categories={categories}
        country={country}
        month={month}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Plan, Ist und Prognose für {label}</caption>
          <thead>
            <tr className="text-left text-muted">
              <th className="px-4 py-2 font-normal" />
              <th className="px-4 py-2 text-right font-normal">Plan</th>
              <th className="px-4 py-2 text-right font-normal">Ist</th>
              <th className="px-4 py-2 text-right font-normal">
                {view.phase === 'future' ? 'Prognose' : forecastLabel}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {table.map(([name, t]) => (
              <tr
                key={name}
                className={`border-t border-border ${name === 'Saldo' ? 'font-semibold' : ''}`}
              >
                <th scope="row" className="px-4 py-2 text-left font-medium">
                  {name}
                </th>
                <td className="px-4 py-2 text-right">{money(t.plan)}</td>
                <td className="px-4 py-2 text-right">{money(t.actual)}</td>
                <td
                  className={`px-4 py-2 text-right ${name === 'Saldo' && t.forecast !== null && t.forecast < 0 ? 'text-bad' : ''}`}
                >
                  {t.forecast === null ? '–' : money(t.forecast)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.phase === 'current' && (
        <p className="text-sm text-muted">
          Prognose: Fixkosten plus bisherige übrige Ausgaben, auf den ganzen Monat hochgerechnet
          (Stand Tag {now.getDate()}).
          {now.getDate() <= 3 && ' Zu Monatsbeginn ist sie noch ungenau.'}
        </p>
      )}

      {view.areas.length === 0 && (
        <p className="rounded-md border border-border bg-surface p-4 text-muted">
          Für diesen Monat gibt es weder Budget noch Buchungen. Lege auf der Seite «Budget»
          Monatsbeträge fest oder erfasse eine Buchung.
        </p>
      )}

      {view.areas.map(({ area, rows }) => (
        <div key={area.id} className="rounded-xl border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-3 text-lg font-semibold">{area.name}</h2>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <Row key={r.category.id} row={r} money={money} />
            ))}
          </ul>
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <CompareCard title="Ausgaben im Vergleich" c={view.compare.ausgaben} money={money} />
        <CompareCard title="Einnahmen im Vergleich" c={view.compare.einnahmen} money={money} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-lg font-semibold">Grösste Ausgaben</h2>
        {view.top.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Ausgaben in diesem Monat.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {view.top.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span className="truncate">
                  {t.date.slice(8, 10)}.{t.date.slice(5, 7)}. · {catName(t.categoryId)}
                  {t.note && <span className="text-muted"> · {t.note}</span>}
                </span>
                <span className="tabular-nums">{money(t.myAmountCents)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <details className="rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer font-semibold">
          Alle Buchungen im {label} ({monthTxs.length})
        </summary>
        {monthTxs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Keine Buchungen.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {monthTxs.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-1.5">
                <span className="truncate">
                  {t.date.slice(8, 10)}.{t.date.slice(5, 7)}. · {catName(t.categoryId)}
                  {t.carId && (
                    <span className="text-muted">
                      {' '}
                      · {cars.find((c) => c.id === t.carId)?.name}
                    </span>
                  )}
                  {t.note && <span className="text-muted"> · {t.note}</span>}
                </span>
                <span className="tabular-nums">
                  {money(t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          Zum Bearbeiten oder Löschen öffne die Seite «Eingabe» und wähle den Monat.
        </p>
      </details>
    </section>
  )
}
