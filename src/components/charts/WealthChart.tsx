import { useState } from 'react'
import { MONTH_NAMES } from '../../lib/months'
import { niceStep } from './scale'
import type { AccountSeries, WealthPoint } from '../../domain/wealth'

export interface WealthChartProps {
  points: WealthPoint[]
  /** Verlauf pro Konto über dieselben Monate wie `points` (aus `accountSeries`). */
  accounts: AccountSeries[]
  money: (cents: number) => string
}

const W = 720
const H = 240
const M = { top: 12, right: 16, bottom: 28, left: 64 }
const SHORT = MONTH_NAMES.map((n) => n.slice(0, 3))
const label = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const TOTAL_KEY = 'gesamt'
const TOTAL_COLOR = 'var(--series-1)'
const ACCOUNT_COLORS = [
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
]

interface Line {
  key: string
  name: string
  color: string
  total: boolean
  values: (number | null)[]
}
type Point = { i: number; v: number }

/** Linienstücke nur zwischen unmittelbar benachbarten Monaten mit Wert: ein Monat ohne Wert bleibt eine Lücke. */
function segmentsOf(values: (number | null)[]): Point[][] {
  const segments: Point[][] = []
  values.forEach((v, i) => {
    if (v === null) return
    const last = segments[segments.length - 1]
    if (last && last[last.length - 1].i === i - 1) last.push({ i, v })
    else segments.push([{ i, v }])
  })
  return segments
}

/**
 * Vermögensverlauf am Monatsende: eine Linie pro Konto und die Linie «Gesamtvermögen». Die Gesamtlinie zeigt nur
 * vollständige Monate (alle einbezogenen Konten haben einen Stand); ein Monat ohne Stand bleibt eine Lücke statt
 * eine falsche Zahl zu behaupten. Über die Kästchen der Legende lässt sich jede Linie aus- und einblenden.
 */
export function WealthChart({ points, accounts, money }: WealthChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const n = points.length
  const lines: Line[] = [
    {
      key: TOTAL_KEY,
      name: 'Gesamtvermögen',
      color: TOTAL_COLOR,
      total: true,
      values: points.map((p) => (p.complete && p.total !== null ? p.total : null)),
    },
    ...accounts.map((s, k) => ({
      key: s.accountId,
      name: s.include ? s.name : `${s.name} (nicht gezählt)`,
      color: ACCOUNT_COLORS[k % ACCOUNT_COLORS.length],
      total: false,
      values: s.values,
    })),
  ]
  const visible = lines.filter((l) => !hidden.has(l.key))
  // Die Gesamtlinie ist nur hervorgehoben, wenn sie neben anderen Linien steht (Issue #113, AK-3)
  const strokeOf = (l: Line) => (l.total && visible.length > 1 ? 4 : 2)
  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const values = visible.flatMap((l) => l.values.filter((v): v is number => v !== null))
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
  const d = (seg: Point[]) =>
    seg.map((s, k) => `${k === 0 ? 'M' : 'L'}${cx(s.i)},${y(s.v)}`).join(' ')
  // Kontolinien zuerst, die Gesamtlinie zuletzt: so liegt sie obenauf
  const drawOrder = [...visible.filter((l) => !l.total), ...visible.filter((l) => l.total)]
  const a = active !== null ? points[active] : null
  const pct = active !== null ? (cx(active) / W) * 100 : 0

  const totalText = (p: WealthPoint) =>
    p.total === null
      ? 'keine Angaben'
      : p.complete
        ? money(p.total)
        : `unvollständig, ${p.missing} Konto${p.missing === 1 ? '' : 'en'} ohne Angabe, bisher ${money(p.total)}`
  const describe = (i: number) => {
    const p = points[i]
    if (visible.length === 0) return `${label(p.month)}: keine Linie gewählt`
    const parts = visible.map((l) => {
      if (l.total) return `Gesamtvermögen ${totalText(p)}`
      const v = l.values[i]
      return `${l.name} ${v === null ? 'keine Angabe' : money(v)}`
    })
    return `${label(p.month)}: ${parts.join('; ')}`
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Vermögensverlauf pro Monatsende, ${label(points[0].month)} bis ${label(points[n - 1].month)}`}
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
        {drawOrder.map((l) => (
          <g key={l.key}>
            {segmentsOf(l.values)
              .filter((s) => s.length > 1)
              .map((s) => (
                <path
                  key={`l${s[0].i}`}
                  data-linie={l.key}
                  d={d(s)}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={strokeOf(l)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            {l.values.map((v, i) =>
              v === null ? null : (
                <circle
                  key={`p${i}`}
                  data-linie={l.key}
                  cx={cx(i)}
                  cy={y(v)}
                  r={l.total ? 4 : 3}
                  fill={l.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ),
            )}
          </g>
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
            aria-label={describe(i)}
            onPointerEnter={() => setActive(i)}
            onPointerMove={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            style={{ outline: 'none' }}
          />
        ))}
      </svg>
      <fieldset className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <legend className="sr-only">Linien im Verlauf</legend>
        {lines.map((l) => (
          <label key={l.key} className="flex min-h-8 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!hidden.has(l.key)}
              onChange={() => toggle(l.key)}
            />
            <svg aria-hidden width={16} height={8} className="shrink-0">
              <line
                data-legende={l.key}
                x1={2}
                x2={14}
                y1={4}
                y2={4}
                stroke={l.color}
                strokeWidth={strokeOf(l)}
                strokeLinecap="round"
              />
            </svg>
            <span className={l.total ? 'font-semibold' : undefined}>{l.name}</span>
          </label>
        ))}
      </fieldset>
      {a && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 w-max rounded-md border border-border bg-surface p-3 text-sm shadow-lg"
          style={
            pct > 50
              ? { right: `${100 - pct}%`, maxWidth: `${pct}%` }
              : { left: `${pct}%`, maxWidth: `${100 - pct}%` }
          }
        >
          <p className="mb-1 font-medium text-muted">{label(a.month)}</p>
          {visible.length === 0 && <p className="text-muted">Keine Linie gewählt</p>}
          {visible.map((l) => {
            const v = l.total ? a.total : l.values[active]
            return (
              <p key={l.key} className="flex flex-wrap items-center gap-x-2">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3"
                  style={{ background: l.color }}
                />
                <span className={l.total ? 'font-semibold' : undefined}>{l.name}</span>
                <span className="tabular-nums">{v === null ? 'keine Angabe' : money(v)}</span>
                {l.total && a.total !== null && !a.complete && (
                  <span className="text-muted">unvollständig ({a.missing} ohne Angabe)</span>
                )}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
