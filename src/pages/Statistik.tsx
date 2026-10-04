import { useState } from 'react'
import { inputClass } from '../auth/ui'
import { ExpenseBars } from '../components/charts/ExpenseBars'
import { MonthlyChart } from '../components/charts/MonthlyChart'
import { MONTH_NAMES } from '../components/MonthSelect'
import { useAllTransactions, useAreas, useBudgets, useCategories, useSettings } from '../data/hooks'
import { formatMoney } from '../domain/money'
import {
  addMonths,
  currentMonth,
  monthRange,
  resolvePeriod,
  type PeriodKind,
} from '../domain/period'
import { buildStats, MAX_STAT_MONTHS, type PlanArea, type PlanRow } from '../domain/statsView'
import type { CategoryType } from '../domain/types'

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'semester', label: 'Semester' },
  { value: 'studienjahr', label: 'Studienjahr' },
  { value: 'halbjahr', label: 'Kalenderhalbjahr' },
  { value: 'jahr', label: 'Kalenderjahr' },
  { value: 'letzte6', label: 'Letzte 6 Monate' },
  { value: 'letzte12', label: 'Letzte 12 Monate' },
  { value: 'frei', label: 'Frei wählbar' },
]

const monthName = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  )
}

/** Wörter zur Abweichung, damit die Aussage nie nur an einer Farbe hängt. */
function deviation(type: CategoryType, diff: number): { word: string; tone: string } {
  if (diff === 0) return { word: 'wie geplant', tone: '' }
  if (type === 'ausgabe')
    return diff > 0 ? { word: 'drüber', tone: 'text-bad' } : { word: 'darunter', tone: 'text-ok' }
  return diff > 0 ? { word: 'mehr', tone: 'text-ok' } : { word: 'weniger', tone: 'text-warn' }
}

function DiffCell({
  type,
  diff,
  money,
}: {
  type: CategoryType | null
  diff: number
  money: (c: number) => string
}) {
  if (type === null)
    return (
      <td className="px-3 py-2 text-right tabular-nums">
        {diff > 0 ? '+' : diff < 0 ? '−' : ''}
        {money(Math.abs(diff))}
      </td>
    )
  const d = deviation(type, diff)
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${d.tone}`}>
      {diff > 0 ? '+' : diff < 0 ? '−' : ''}
      {money(Math.abs(diff))} <span className="text-xs">{d.word}</span>
    </td>
  )
}

function PlanTable({ areas, money }: { areas: PlanArea[]; money: (c: number) => string }) {
  if (areas.length === 0)
    return (
      <p className="text-sm text-muted">In diesem Zeitraum gibt es weder Budget noch Buchungen.</p>
    )
  const typeOfArea = (a: PlanArea): CategoryType | null => {
    const types = new Set(a.rows.map((r) => r.category.type))
    return types.size === 1 ? [...types][0] : null
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Plan und Ist pro Kategorie im gewählten Zeitraum</caption>
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" className="px-3 py-2 font-normal">
              Kategorie
            </th>
            <th scope="col" className="px-3 py-2 text-right font-normal">
              Plan
            </th>
            <th scope="col" className="px-3 py-2 text-right font-normal">
              Ist
            </th>
            <th scope="col" className="px-3 py-2 text-right font-normal">
              Abweichung
            </th>
          </tr>
        </thead>
        {areas.map((a) => (
          <tbody key={a.area.id} className="border-t border-border">
            <tr className="bg-bg font-semibold">
              <th scope="rowgroup" className="px-3 py-2 text-left">
                {a.area.name}
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{money(a.plan)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(a.actual)}</td>
              <DiffCell type={typeOfArea(a)} diff={a.diff} money={money} />
            </tr>
            {a.rows.map((r: PlanRow) => (
              <tr key={r.category.id} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {r.category.name}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{money(r.plan)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(r.actual)}</td>
                <DiffCell type={r.category.type} diff={r.diff} money={money} />
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

export function Statistik() {
  const settings = useSettings()
  const categories = useCategories()
  const areas = useAreas()
  const budgets = useBudgets()
  const txs = useAllTransactions()
  const [kind, setKind] = useState<PeriodKind>('semester')
  const [ref, setRef] = useState(currentMonth())
  const [custom, setCustom] = useState({ from: addMonths(currentMonth(), -2), to: currentMonth() })

  if (!settings) return null
  const money = (c: number) => formatMoney(c, settings.country)

  const customCount = custom.from <= custom.to ? monthRange(custom.from, custom.to).length : 0
  const customError =
    kind !== 'frei'
      ? null
      : custom.from > custom.to
        ? 'Der Start muss vor dem Ende liegen.'
        : customCount > MAX_STAT_MONTHS
          ? `Bitte wähle höchstens ${MAX_STAT_MONTHS} Monate.`
          : null
  const period = resolvePeriod(
    kind,
    ref,
    settings.semesters,
    kind === 'frei' && !customError ? custom : undefined,
  )
  const range = customError ? { from: ref, to: ref } : period
  const stats = buildStats({ from: range.from, to: range.to, categories, areas, budgets, txs })

  const shift = (dir: -1 | 1) => {
    if (kind === 'letzte6') setRef(addMonths(ref, dir * 6))
    else if (kind === 'letzte12') setRef(addMonths(ref, dir * 12))
    else setRef(dir < 0 ? addMonths(period.from, -1) : addMonths(period.to, 1))
  }

  const { totals, key } = stats
  const pct = (v: number | null) =>
    v === null ? '–' : `${v.toLocaleString('de-CH', { maximumFractionDigits: 1 })} %`

  return (
    <section className="max-w-4xl space-y-6 xl:max-w-6xl 2xl:max-w-7xl">
      <h1 className="text-2xl font-semibold">Statistik</h1>

      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Zeitraum wählen">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Zeitraum</span>
          <select
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as PeriodKind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {kind === 'frei' ? (
          <>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Von</span>
              <input
                type="month"
                className={inputClass}
                value={custom.from}
                onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Bis</span>
              <input
                type="month"
                className={inputClass}
                value={custom.to}
                onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })}
              />
            </label>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-border px-3 py-2"
              aria-label="Vorheriger Zeitraum"
              onClick={() => shift(-1)}
            >
              ◀
            </button>
            <button
              className="rounded-md border border-border px-3 py-2"
              aria-label="Nächster Zeitraum"
              onClick={() => shift(1)}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {customError ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {customError}
        </p>
      ) : (
        <p className="text-muted" aria-live="polite">
          {period.label} · {monthName(range.from)} bis {monthName(range.to)}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Einnahmen" value={money(totals.einnahmen)} />
        <Tile label="Ausgaben" value={money(totals.ausgaben)} />
        <Tile label="Gespart" value={money(totals.sparen)} />
        <Tile label="Saldo" value={money(totals.saldo)} hint="Einnahmen − Ausgaben − Sparen" />
        <Tile label="Ø Ausgaben pro Monat" value={money(key.avgExpensesPerMonth)} />
        <Tile
          label="Sparquote"
          value={pct(key.savingsRatePct)}
          hint="Gespart im Verhältnis zu den Einnahmen"
        />
        <Tile label="Anteil Fixkosten" value={pct(key.fixSharePct)} hint="an allen Ausgaben" />
        <Tile
          label="Teuerster Monat"
          value={key.mostExpensiveMonth ? monthName(key.mostExpensiveMonth) : '–'}
          hint={
            key.mostExpensiveMonth
              ? money(stats.months.find((m) => m.month === key.mostExpensiveMonth)!.ausgaben)
              : undefined
          }
        />
      </dl>

      <figure className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <figcaption>
          <h2 className="text-lg font-semibold">Ausgaben nach Bereich</h2>
          <p className="text-sm text-muted">
            Dein Anteil. Ein Klick auf einen Bereich zeigt die Kategorien.
          </p>
        </figcaption>
        <ExpenseBars areas={stats.expensesByArea} money={money} />
        <details>
          <summary className="cursor-pointer text-sm text-accent">Als Tabelle anzeigen</summary>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="py-1 font-normal">
                  Bereich
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  Betrag
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  Anteil
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.expensesByArea.map((a) => (
                <tr key={a.area.id} className="border-t border-border">
                  <th scope="row" className="py-1 text-left font-normal">
                    {a.area.name}
                  </th>
                  <td className="py-1 text-right tabular-nums">{money(a.total)}</td>
                  <td className="py-1 text-right tabular-nums">{Math.round(a.sharePct)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>

      <figure className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <figcaption>
          <h2 className="text-lg font-semibold">Verlauf pro Monat</h2>
          <p className="text-sm text-muted">
            Einnahmen und Ausgaben als Säulen, der Saldo als Linie. Beträge in{' '}
            {settings.country === 'CH' ? 'CHF' : 'EUR'}.
          </p>
        </figcaption>
        <MonthlyChart months={stats.months} money={money} />
        <details>
          <summary className="cursor-pointer text-sm text-accent">Als Tabelle anzeigen</summary>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="py-1 font-normal">
                    Monat
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    Einnahmen
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    Ausgaben
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    Gespart
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.months.map((m) => (
                  <tr key={m.month} className="border-t border-border">
                    <th scope="row" className="py-1 text-left font-normal">
                      {monthName(m.month)}
                    </th>
                    <td className="py-1 text-right tabular-nums">{money(m.einnahmen)}</td>
                    <td className="py-1 text-right tabular-nums">{money(m.ausgaben)}</td>
                    <td className="py-1 text-right tabular-nums">{money(m.sparen)}</td>
                    <td className="py-1 text-right tabular-nums">{money(m.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figure>

      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Plan und Ist</h2>
        <p className="text-sm text-muted">
          Der Plan ist die Summe deiner Monatsbudgets im Zeitraum.
        </p>
        <PlanTable areas={stats.planVsActual} money={money} />
      </div>
    </section>
  )
}
