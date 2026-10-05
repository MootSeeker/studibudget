import { useState } from 'react'
import { MONTH_NAMES } from '../../lib/months'
import { niceStep } from './scale'
import type { MonthTotals } from '../../domain/stats'

export interface MonthlyChartProps {
  months: MonthTotals[]
  money: (cents: number) => string
}

const W = 720
const H = 260
const M = { top: 12, right: 12, bottom: 28, left: 56 }
const SHORT = MONTH_NAMES.map((n) => n.slice(0, 3))

/** Rechteck mit 4 px runden Enden oben, gerade an der Grundlinie. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

/**
 * Einnahmen und Ausgaben als Säulen, Saldo als Linie, alles auf einer Achse in Rappen/Cent.
 * Jeder Monat ist ein Treffer-Bereich mit Tooltip (Zeiger und Tastatur).
 */
export function MonthlyChart({ months, money }: MonthlyChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const n = months.length
  const values = months.flatMap((m) => [m.einnahmen, m.ausgaben, m.saldo, 0])
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const step = niceStep(rawMax - rawMin || 100_00)
  const min = Math.floor(rawMin / step) * step
  const max = Math.ceil(rawMax / step) * step || step
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom
  const y = (v: number) => M.top + plotH - ((v - min) / (max - min)) * plotH
  const band = plotW / n
  const barW = Math.min(24, Math.max(3, (band - 6) / 2 - 1))
  const cx = (i: number) => M.left + band * i + band / 2
  const ticks: number[] = []
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(v)
  const labelEvery = n > 24 ? 3 : n > 12 ? 2 : 1
  const fmtTick = (c: number) => (c / 100).toLocaleString('de-CH', { maximumFractionDigits: 0 })
  const line = months.map((m, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${y(m.saldo)}`).join(' ')
  const a = active !== null ? months[active] : null
  const monthLabel = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Einnahmen, Ausgaben und Saldo pro Monat, ${monthLabel(months[0].month)} bis ${monthLabel(months[n - 1].month)}`}
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
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtTick(v)}
            </text>
          </g>
        ))}
        {months.map((m, i) => {
          const h1 = Math.max(0, y(0) - y(m.einnahmen))
          const h2 = Math.max(0, y(0) - y(m.ausgaben))
          return (
            <g key={m.month} opacity={active === null || active === i ? 1 : 0.55}>
              {h1 > 0 && (
                <path
                  d={barPath(cx(i) - barW - 1, y(m.einnahmen), barW, h1)}
                  fill="var(--series-1)"
                />
              )}
              {h2 > 0 && (
                <path d={barPath(cx(i) + 1, y(m.ausgaben), barW, h2)} fill="var(--series-2)" />
              )}
            </g>
          )
        })}
        {n > 1 && (
          <path
            d={line}
            fill="none"
            stroke="var(--text)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {months.map((m, i) => (
          <circle
            key={m.month}
            cx={cx(i)}
            cy={y(m.saldo)}
            r={4}
            fill="var(--text)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}
        {months.map((m, i) =>
          i % labelEvery === 0 ? (
            <text
              key={m.month}
              x={cx(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--muted)"
            >
              {SHORT[Number(m.month.slice(5, 7)) - 1]}
              {m.month.slice(5, 7) === '01' || i === 0 ? ` ${m.month.slice(2, 4)}` : ''}
            </text>
          ) : null,
        )}
        {active !== null && (
          <line
            x1={cx(active)}
            x2={cx(active)}
            y1={M.top}
            y2={M.top + plotH}
            stroke="var(--muted)"
            strokeWidth={1}
          />
        )}
        {months.map((m, i) => (
          <rect
            key={m.month}
            x={M.left + band * i}
            y={M.top}
            width={band}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`${monthLabel(m.month)}: Einnahmen ${money(m.einnahmen)}, Ausgaben ${money(m.ausgaben)}, Saldo ${money(m.saldo)}`}
            onPointerEnter={() => setActive(i)}
            onPointerMove={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            style={{ outline: 'none' }}
          />
        ))}
      </svg>

      {a && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-md border border-border bg-surface p-3 text-sm shadow-lg"
          style={{ left: `${Math.min(70, (cx(active) / W) * 100)}%` }}
        >
          <p className="mb-1 font-medium text-muted">{monthLabel(a.month)}</p>
          {(
            [
              ['Einnahmen', a.einnahmen, 'var(--series-1)'],
              ['Ausgaben', a.ausgaben, 'var(--series-2)'],
              ['Saldo', a.saldo, 'var(--text)'],
            ] as const
          ).map(([label, value, color]) => (
            <p key={label} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-0.5 w-3" style={{ background: color }} />
              <span className="font-semibold tabular-nums">{money(value)}</span>
              <span className="text-muted">{label}</span>
            </p>
          ))}
        </div>
      )}

      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legende">
        {(
          [
            ['Einnahmen', 'var(--series-1)', 'rect'],
            ['Ausgaben', 'var(--series-2)', 'rect'],
            ['Saldo', 'var(--text)', 'line'],
          ] as const
        ).map(([label, color, kind]) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                kind === 'rect' ? 'inline-block h-3 w-3 rounded-sm' : 'inline-block h-0.5 w-4'
              }
              style={{ background: color }}
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
