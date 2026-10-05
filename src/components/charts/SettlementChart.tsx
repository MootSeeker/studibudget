import { useState } from 'react'
import { MONTH_NAMES } from '../../lib/months'
import type { PersonMonthSettlement } from '../../domain/settlement'
import { niceStep } from './scale'

export interface SettlementChartProps {
  months: string[]
  persons: { id: string; name: string }[]
  rows: PersonMonthSettlement[]
  money: (cents: number) => string
}

const W = 720
const H = 260
const M = { top: 12, right: 12, bottom: 28, left: 56 }
const SHORT = MONTH_NAMES.map((n) => n.slice(0, 3))
const monthLabel = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

/**
 * Ausgleichszahlungen pro Monat: je Person eine Säule «ich zahle» (Orange) und eine «ich erhalte» (Blau).
 * Die Richtung steht zusätzlich in Tooltip, Legende und Tabelle, damit sie nicht nur an der Farbe hängt.
 */
export function SettlementChart({ months, persons, rows, money }: SettlementChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const n = months.length
  const max0 = Math.max(0, ...rows.flatMap((r) => [r.paid, r.received]))
  const step = niceStep(max0 || 100_00)
  const max = Math.ceil(max0 / step) * step || step
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom
  const y = (v: number) => M.top + plotH - (v / max) * plotH
  const band = plotW / n
  const slots = Math.max(1, persons.length * 2)
  const barW = Math.min(18, Math.max(2, (band - 6) / slots))
  const cx = (i: number) => M.left + band * i + band / 2
  const labelEvery = n > 24 ? 3 : n > 12 ? 2 : 1
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v)
  const fmtTick = (c: number) => (c / 100).toLocaleString('de-CH', { maximumFractionDigits: 0 })
  const rowOf = (m: string, p: string) => rows.find((r) => r.month === m && r.personId === p)
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? 'Unbekannt'
  const x0 = (i: number) => cx(i) - (slots * barW) / 2

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Ausgleichszahlungen pro Person und Monat, ${monthLabel(months[0])} bis ${monthLabel(months[n - 1])}`}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeWidth={v === 0 ? 1.5 : 1}
            />
            <text
              x={M.left - 8}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--muted)"
            >
              {fmtTick(v)}
            </text>
          </g>
        ))}
        {months.map((m, i) => (
          <g key={m} opacity={active === null || active === i ? 1 : 0.55}>
            {persons.map((p, j) => {
              const r = rowOf(m, p.id)
              if (!r) return null
              return (
                <g key={p.id}>
                  {r.paid > 0 && (
                    <rect
                      x={x0(i) + j * 2 * barW}
                      y={y(r.paid)}
                      width={barW - 1}
                      height={y(0) - y(r.paid)}
                      fill="var(--series-2)"
                    />
                  )}
                  {r.received > 0 && (
                    <rect
                      x={x0(i) + (j * 2 + 1) * barW}
                      y={y(r.received)}
                      width={barW - 1}
                      height={y(0) - y(r.received)}
                      fill="var(--series-1)"
                    />
                  )}
                </g>
              )
            })}
            {i % labelEvery === 0 && (
              <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {SHORT[Number(m.slice(5, 7)) - 1]}
                {m.slice(5, 7) === '01' || i === 0 ? ` ${m.slice(2, 4)}` : ''}
              </text>
            )}
          </g>
        ))}
        {months.map((m, i) => (
          <rect
            key={m}
            x={M.left + band * i}
            y={M.top}
            width={band}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`${monthLabel(m)}: ${
              persons
                .map((p) => {
                  const r = rowOf(m, p.id)
                  return `${p.name} bezahlt ${money(r?.paid ?? 0)}, erhalten ${money(r?.received ?? 0)}`
                })
                .join('; ') || 'keine Zahlungen'
            }`}
            onPointerEnter={() => setActive(i)}
            onPointerMove={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            style={{ outline: 'none' }}
          />
        ))}
      </svg>

      {active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-48 rounded-md border border-border bg-surface p-3 text-sm shadow-lg"
          style={{ left: `${Math.min(65, (cx(active) / W) * 100)}%` }}
        >
          <p className="mb-1 font-medium text-muted">{monthLabel(months[active])}</p>
          {persons.map((p) => {
            const r = rowOf(months[active], p.id)
            return (
              <p key={p.id} className="tabular-nums">
                <span className="font-semibold">{nameOf(p.id)}</span>: bezahlt {money(r?.paid ?? 0)}
                , erhalten {money(r?.received ?? 0)}
              </p>
            )
          })}
        </div>
      )}

      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legende">
        {(
          [
            ['Ich zahle (links je Person)', 'var(--series-2)'],
            ['Ich erhalte (rechts je Person)', 'var(--series-1)'],
          ] as const
        ).map(([label, color]) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: color }}
            />
            {label}
          </li>
        ))}
        <li className="text-muted">
          Reihenfolge der Personen: {persons.map((p) => p.name).join(', ')}
        </li>
      </ul>
    </div>
  )
}
