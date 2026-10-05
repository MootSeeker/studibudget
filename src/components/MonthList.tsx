import { Collapsible } from './Collapsible'
import type { AreaGroup } from '../domain/ledger'
import { formatMoney } from '../domain/money'
import type { Car, Country, Person, Transaction } from '../domain/types'
import { useOpenSet } from '../lib/useOpenSet'

/** Bis zu so vielen Buchungen im Monat sind alle Bereiche offen; darüber starten sie eingeklappt. */
export const OPEN_UP_TO = 15

export interface MonthListProps {
  groups: AreaGroup[]
  country: Country
  persons: Person[]
  cars?: Car[]
  onEdit(tx: Transaction): void
  onDelete(tx: Transaction): void
}

const day = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`

export function MonthList({
  groups,
  country,
  persons,
  cars = [],
  onEdit,
  onDelete,
}: MonthListProps) {
  const money = (c: number) => formatMoney(c, country)
  const total = groups.reduce((n, g) => n + g.categories.reduce((m, c) => m + c.txs.length, 0), 0)
  const open = useOpenSet(
    'studibudget:eingabe-bereiche-offen',
    groups.map((g) => g.area.id),
    () => total <= OPEN_UP_TO,
  )
  const name = (who: string) =>
    who === 'me' ? 'mir' : (persons.find((p) => p.id === who)?.name ?? 'unbekannt')

  if (groups.length === 0)
    return <p className="text-muted">In diesem Monat gibt es noch keine Buchungen.</p>

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const count = g.categories.reduce((m, c) => m + c.txs.length, 0)
        return (
          <Collapsible
            key={g.area.id}
            headingLevel={3}
            title={g.area.name}
            summary={`${count} ${count === 1 ? 'Buchung' : 'Buchungen'} · ${money(g.total)}`}
            open={open.isOpen(g.area.id)}
            onToggle={() => open.toggle(g.area.id)}
          >
            <div className="divide-y divide-border">
              {g.categories.map((c) => (
                <div key={c.category.id} className="px-4 py-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{c.category.name}</span>
                    <span>{money(c.total)}</span>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {c.txs.map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                      >
                        <span className="w-12 shrink-0 text-muted">{day(t.date)}</span>
                        <span className="min-w-0 flex-1 basis-32 break-words">
                          {t.note || <span className="text-muted">–</span>}
                          {t.shared && (
                            <span className="ml-2 text-xs text-muted">
                              von {money(t.amountCents)}, bezahlt von {name(t.shared.paidBy)}
                            </span>
                          )}
                          {t.carId && (
                            <span className="ml-2 text-xs text-muted">
                              {cars.find((x) => x.id === t.carId)?.name}
                            </span>
                          )}
                          {t.goalDirection === 'entnahme' && (
                            <span className="ml-2 text-xs text-muted">Entnahme</span>
                          )}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                          <span className="mr-2 tabular-nums">
                            {money(
                              t.goalDirection === 'entnahme' ? -t.myAmountCents : t.myAmountCents,
                            )}
                          </span>
                          <button
                            className="px-2 py-2 text-accent underline"
                            onClick={() => onEdit(t)}
                            aria-label={`Bearbeiten ${t.note || c.category.name}`}
                          >
                            Bearbeiten
                          </button>
                          <button
                            className="px-2 py-2 text-bad underline"
                            onClick={() => onDelete(t)}
                            aria-label={`Löschen ${t.note || c.category.name}`}
                          >
                            Löschen
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Collapsible>
        )
      })}
    </div>
  )
}
