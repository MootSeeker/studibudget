import { inputClass } from '../auth/ui'
import { store } from '../data/store'
import { formatMoney, parseAmount } from '../domain/money'
import { rescaleShared } from '../domain/split'
import type { Category, Country, Template } from '../domain/types'
import { MONTH_NAMES } from './MonthSelect'

export interface TemplatesPanelProps {
  templates: Template[]
  categories: Category[]
  country: Country
}

const strip = ({ updatedAt: _u, ...rest }: Template) => rest

/** Fixkosten-Vorlagen: Betrag, Notiz und Monate anpassen, pausieren oder löschen. */
export function TemplatesPanel({ templates, categories, country }: TemplatesPanelProps) {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt'
  const save = (t: Template, patch: Partial<Template>) =>
    store.put('templates', { ...strip(t), ...patch })

  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer font-semibold">
        Fixkosten-Vorlagen ({templates.length})
      </summary>
      {templates.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Noch keine Vorlagen. Setze beim Erfassen einer Buchung das Häkchen «Jeden Monat
          wiederholen».
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {templates.map((t) => (
            <li key={t.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm">{catName(t.categoryId)}</strong>
                <span className="text-sm text-muted">{formatMoney(t.amountCents, country)}</span>
                {!t.active && <span className="rounded bg-border px-2 text-xs">pausiert</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  aria-label={`Betrag Vorlage ${catName(t.categoryId)}`}
                  className={inputClass}
                  inputMode="decimal"
                  defaultValue={(t.amountCents / 100).toFixed(2)}
                  onBlur={(e) => {
                    const cents = parseAmount(e.target.value)
                    if (cents && cents > 0 && cents !== t.amountCents)
                      void save(t, {
                        amountCents: cents,
                        ...(t.shared ? { shared: rescaleShared(t.shared, cents) } : {}),
                      })
                  }}
                />
                <input
                  aria-label={`Notiz Vorlage ${catName(t.categoryId)}`}
                  className={inputClass}
                  defaultValue={t.note}
                  onBlur={(e) =>
                    e.target.value !== t.note && void save(t, { note: e.target.value.trim() })
                  }
                />
              </div>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label={`Monate ${catName(t.categoryId)}`}
              >
                {MONTH_NAMES.map((name, i) => {
                  const on = t.months.includes(i + 1)
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={on}
                      className={`rounded border px-2 py-1 text-xs ${on ? 'border-accent bg-accent/10' : 'border-border text-muted'}`}
                      onClick={() => {
                        const months = on
                          ? t.months.filter((m) => m !== i + 1)
                          : [...t.months, i + 1].sort((a, b) => a - b)
                        if (months.length > 0) void save(t, { months })
                      }}
                    >
                      {name.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-3 text-sm">
                <button
                  className="text-accent underline"
                  onClick={() => void save(t, { active: !t.active })}
                >
                  {t.active ? 'Pausieren' : 'Fortsetzen'}
                </button>
                <button
                  className="text-red-600 underline dark:text-red-400"
                  onClick={() =>
                    window.confirm('Vorlage löschen? Bereits gebuchte Monate bleiben bestehen.') &&
                    void store.remove('templates', t.id)
                  }
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
