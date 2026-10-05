import { useState } from 'react'
import { MONTH_NAMES } from '../../lib/months'
import { niceStep } from './scale'
import type { WealthPoint } from '../../domain/wealth'

export interface WealthChartProps {
  points: WealthPoint[]
  money: (cents: number) => string
}

const W = 720
const H = 240
const M = { top: 12, right: 16, bottom: 28, left: 64 }
const SHORT = MONTH_NAMES.map((n) => n.slice(0, 3))
const label = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

/**
 * Gesamtvermögen am Monatsende. Gezeichnet werden nur vollständige Monate (alle einbezogenen Konten haben
 * einen Stand); ein unvollständiger Monat bleibt eine Lücke statt eine falsche Zahl zu behaupten.
 */
export function WealthChart({ points, money }: WealthChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const n = points.length
  const full = points.map((p, i) => ({ p, i })).filter((x) => x.p.complete && x.p.total !== null)
  const values = full.map((x) => x.p.total as number)
  const rawMin = Math.min(0, ...values)
  const rawMax = Math.max(0, ...values)
  const step = niceStep(rawMax - rawMin || 100_00)
  const min = Math.floor(rawMin / step) * step
  const max = Math.ceil(rawMax / step) * step || step
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom
  const band = plotW / n
  const cx = (i: number) => M.left + band * i + band / 2
  const y = (v: number) => M.top + plotH - ((v - min) / (max - min)) * plotH
  const ticks: number[] = []
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(v)
  const fmtTick = (c: number) => (c / 100).toLocaleString('de-CH', { maximumFractionDigits: 0 })

  // Linienstücke nur zwischen unmittelbar benachbarten vollständigen Monaten
  const segments: { i: number; v: number }[][] = []
  for (const { p, i } of full) {
    const last = segments[segments.length - 1]
    if (last && last[last.length - 1].i === i - 1) last.push({ i, v: p.total as number })
    else segments.push([{ i, v: p.total as number }])
  }
  const d = (seg: { i: number; v: number }[]) =>
    seg.map((s, k) => `${k === 0 ? 'M' : 'L'}${cx(s.i)},${y(s.v)}`).join(' ')
  const area = (seg: { i: number; v: number }[]) =>
    `${d(seg)} L${cx(seg[seg.length - 1].i)},${y(0)} L${cx(seg[0].i)},${y(0)} Z`
  const a = active !== null ? points[active] : null

  const describe = (p: WealthPoint) =>
    p.total === null
      ? `${label(p.month)}: keine Angaben`
      : p.complete
        ? `${label(p.month)}: Gesamtvermögen ${money(p.total)}`
        : `${label(p.month)}: unvollständig, ${p.missing} Konto${p.missing === 1 ? '' : 'en'} ohne Angabe, bisher ${money(p.total)}`

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Gesamtvermögen pro Monatsende, ${label(points[0].month)} bis ${label(points[n - 1].month)}`}
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
        {segments
          .filter((s) => s.length > 1)
          .map((s) => (
            <path key={`a${s[0].i}`} d={area(s)} fill="var(--series-1)" opacity={0.1} />
          ))}
        {segments
          .filter((s) => s.length > 1)
          .map((s) => (
            <path
              key={`l${s[0].i}`}
              d={d(s)}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        {full.map(({ p, i }) => (
          <circle
            key={p.month}
            cx={cx(i)}
            cy={y(p.total as number)}
            r={4}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}
        {points.map((p, i) => (
          <text
            key={p.month}
            x={cx(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted)"
          >
            {SHORT[Number(p.month.slice(5, 7)) - 1]}
            {p.month.slice(5, 7) === '01' || i === 0 ? ` ${p.month.slice(2, 4)}` : ''}
          </text>
        ))}
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
        {points.map((p, i) => (
          <rect
            key={p.month}
            x={M.left + band * i}
            y={M.top}
            width={band}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={describe(p)}
            onPointerEnter={() => setActive(i)}
            onPointerMove={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            style={{ outline: 'none' }}
          />
        ))}
      </svg>
      {a && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-md border border-border bg-surface p-3 text-sm shadow-lg"
          style={{ left: `${Math.min(70, (cx(active as number) / W) * 100)}%` }}
        >
          <p className="mb-1 font-medium text-muted">{label(a.month)}</p>
          {a.total === null ? (
            <p className="text-muted">Keine Angaben</p>
          ) : (
            <p className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3"
                style={{ background: 'var(--series-1)' }}
              />
              <span className="font-semibold tabular-nums">{money(a.total)}</span>
              <span className="text-muted">
                {a.complete ? 'Vermögen' : `unvollständig (${a.missing} ohne Angabe)`}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
