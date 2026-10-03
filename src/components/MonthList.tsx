import type { AreaGroup } from '../domain/ledger'
import { formatMoney } from '../domain/money'
import type { Country, Person, Transaction } from '../domain/types'

export interface MonthListProps {
  groups: AreaGroup[]
  country: Country
  persons: Person[]
  onEdit(tx: Transaction): void
  onDelete(tx: Transaction): void
}

const day = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`

export function MonthList({ groups, country, persons, onEdit, onDelete }: MonthListProps) {
  const money = (c: number) => formatMoney(c, country)
  const name = (who: string) =>
    who === 'me' ? 'mir' : (persons.find((p) => p.id === who)?.name ?? 'unbekannt')

  if (groups.length === 0)
    return <p className="text-muted">In diesem Monat gibt es noch keine Buchungen.</p>

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <details key={g.area.id} open className="rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-semibold">
            <span>{g.area.name}</span>
            <span>{money(g.total)}</span>
          </summary>
          <div className="divide-y divide-border border-t border-border">
            {g.categories.map((c) => (
              <div key={c.category.id} className="px-4 py-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{c.category.name}</span>
                  <span>{money(c.total)}</span>
                </div>
                <ul className="mt-1 space-y-1">
                  {c.txs.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 text-sm">
                      <span className="w-12 shrink-0 text-muted">{day(t.date)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {t.note || <span className="text-muted">–</span>}
                        {t.shared && (
                          <span className="ml-2 text-xs text-muted">
                            von {money(t.amountCents)}, bezahlt von {name(t.shared.paidBy)}
                          </span>
                        )}
                        {t.goalDirection === 'entnahme' && (
                          <span className="ml-2 text-xs text-muted">Entnahme</span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {money(t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents)}
                      </span>
                      <button
                        className="text-accent underline"
                        onClick={() => onEdit(t)}
                        aria-label={`Bearbeiten ${t.note || c.category.name}`}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="text-red-600 underline dark:text-red-400"
                        onClick={() => onDelete(t)}
                        aria-label={`Löschen ${t.note || c.category.name}`}
                      >
                        Löschen
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
