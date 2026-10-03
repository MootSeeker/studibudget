import { useState } from 'react'
import type { ExpenseArea } from '../../domain/statsView'

export interface ExpenseBarsProps {
  areas: ExpenseArea[]
  money: (cents: number) => string
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max(1, (value / max) * 100) : 0
  return (
    <div className="h-4 w-full" role="img" aria-label={label}>
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: 'var(--series-1)',
          borderRadius: '0 4px 4px 0',
          maxHeight: 16,
        }}
      />
    </div>
  )
}

/** Ausgaben nach Bereich als waagrechte Balken; ein Klick klappt die Kategorien darunter auf. */
export function ExpenseBars({ areas, money }: ExpenseBarsProps) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const max = Math.max(0, ...areas.map((a) => a.total))
  const toggle = (id: string) =>
    setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))

  if (areas.length === 0)
    return <p className="text-sm text-muted">In diesem Zeitraum gibt es keine Ausgaben.</p>

  return (
    <ul className="space-y-3">
      {areas.map((a) => {
        const isOpen = open.has(a.area.id)
        const catMax = Math.max(0, ...a.categories.map((c) => c.total))
        return (
          <li key={a.area.id}>
            <button
              type="button"
              className="grid w-full grid-cols-[1fr_auto] items-baseline gap-3 text-left"
              aria-expanded={isOpen}
              aria-controls={`bereich-${a.area.id}`}
              onClick={() => toggle(a.area.id)}
            >
              <span className="font-medium">
                <span aria-hidden className="mr-1 inline-block w-3 text-muted">
                  {isOpen ? '▾' : '▸'}
                </span>
                {a.area.name}
              </span>
              <span className="tabular-nums">
                {money(a.total)} <span className="text-muted">· {Math.round(a.sharePct)} %</span>
              </span>
            </button>
            <Bar
              value={a.total}
              max={max}
              label={`${a.area.name}: ${money(a.total)}, ${Math.round(a.sharePct)} Prozent`}
            />
            {isOpen && (
              <ul
                id={`bereich-${a.area.id}`}
                className="mt-2 space-y-2 border-l border-border pl-4"
              >
                {a.categories.map((c) => (
                  <li key={c.category.id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{c.category.name}</span>
                      <span className="tabular-nums">{money(c.total)}</span>
                    </div>
                    <Bar
                      value={c.total}
                      max={catMax}
                      label={`${c.category.name}: ${money(c.total)}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
