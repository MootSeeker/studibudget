import { formatMoney } from '../domain/money'
import { reservePlan } from '../domain/templates'
import type { Category, Country, Template } from '../domain/types'
import { MONTH_NAMES } from '../lib/months'

export interface ReserveHintProps {
  templates: Template[]
  categories: Category[]
  country: Country
  month: string
  /** Kompakt: eine Zeile (Monatsseite); sonst mit Aufstellung (Budget). */
  compact?: boolean
}

/** Hinweis auf Rückstellung für Kosten, die nicht jeden Monat fällig sind. Ändert weder Saldo noch Ampel. */
export function ReserveHint({ templates, categories, country, month, compact }: ReserveHintProps) {
  const plan = reservePlan(templates, categories, month)
  if (plan.items.length === 0) return null
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt'
  const next = [...plan.items].sort(
    (a, b) =>
      ((a.nextMonth - Number(month.slice(5, 7)) + 12) % 12) -
      ((b.nextMonth - Number(month.slice(5, 7)) + 12) % 12),
  )[0]
  const summary = `Lege für Kosten, die nicht jeden Monat anfallen, ${formatMoney(plan.totalCents, country)} pro Monat beiseite.`
  return (
    <aside
      aria-label="Rückstellung"
      className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm"
    >
      <p>
        {summary}
        {compact && (
          <span className="text-muted">
            {' '}
            Nächste Fälligkeit: {name(next.categoryId)} im {MONTH_NAMES[next.nextMonth - 1]}.
          </span>
        )}
      </p>
      {!compact && (
        <ul className="space-y-1">
          {plan.items.map((i) => (
            <li key={i.templateId} className="flex justify-between gap-3">
              <span>
                {name(i.categoryId)}{' '}
                <span className="text-muted">(fällig im {MONTH_NAMES[i.nextMonth - 1]})</span>
              </span>
              <span>{formatMoney(i.perMonthCents, country)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">Nur ein Hinweis: Saldo und Ampel bleiben unverändert.</p>
    </aside>
  )
}
