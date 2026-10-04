import { inputClass } from '../auth/ui'
import { store } from '../data/store'
import { formatMoney, parseAmount } from '../domain/money'
import { rescaleShared } from '../domain/split'
import {
  detectInterval,
  INTERVALS,
  monthsForInterval,
  type IntervalEvery,
} from '../domain/templates'
import type { Category, Country, Template } from '../domain/types'
import { MONTH_NAMES } from './MonthSelect'

export interface TemplatesPanelProps {
  templates: Template[]
  categories: Category[]
  country: Country
}

/** Fixkosten-Vorlagen: Betrag, Notiz und Monate anpassen, pausieren oder löschen. */
export function TemplatesPanel({ templates, categories, country }: TemplatesPanelProps) {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt'
  type Change = Partial<Omit<Template, 'updatedAt'>>
  const save = (t: Template, changes: Change | ((current: Template) => Change)) =>
    store.patch('templates', t.id, changes)

  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer font-semibold">
        Fixkosten-Vorlagen ({templates.length})
      </summary>
      {templates.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Noch keine Vorlagen. Setze beim Erfassen einer Buchung das Häkchen «Wiederholen».
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
                      void save(t, (cur) => ({
                        amountCents: cents,
                        ...(cur.shared ? { shared: rescaleShared(cur.shared, cents) } : {}),
                      }))
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
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs text-muted">Intervall</span>
                  <select
                    aria-label={`Intervall ${catName(t.categoryId)}`}
                    className={inputClass}
                    value={String(detectInterval(t.months)?.every ?? 'eigene')}
                    onChange={(e) => {
                      if (e.target.value === 'eigene') return
                      const every = Number(e.target.value) as IntervalEvery
                      void save(t, (cur) => ({
                        months: monthsForInterval(
                          every,
                          detectInterval(cur.months)?.startMonth ?? cur.months[0] ?? 1,
                        ),
                      }))
                    }}
                  >
                    {INTERVALS.map((i) => (
                      <option key={i.every} value={i.every}>
                        {i.label}
                      </option>
                    ))}
                    {detectInterval(t.months) === null && (
                      <option value="eigene">Eigene Auswahl</option>
                    )}
                  </select>
                </label>
                {t.months.length < 12 && (
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!t.noReserve}
                      onChange={(e) => void save(t, { noReserve: !e.target.checked })}
                    />
                    In Rückstellung einrechnen
                  </label>
                )}
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
                        // Auf dem aktuellen Stand umschalten, nicht auf dem Bildschirmzustand.
                        void save(t, (cur) => {
                          const months = cur.months.includes(i + 1)
                            ? cur.months.filter((m) => m !== i + 1)
                            : [...cur.months, i + 1].sort((a, b) => a - b)
                          return months.length > 0 ? { months } : {}
                        })
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
