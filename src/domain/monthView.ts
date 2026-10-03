import { actualForMonth, budgetForMonth, rolloverCents } from './budget'
import { summarizeBudget } from './budgetPlan'
import { ampel, averageOfMonths, forecastExpenses, type AmpelResult } from './month'
import { addMonths, monthOf, type MonthKey } from './period'
import { totalsByMonth } from './stats'
import { openTemplates } from './templates'
import type { Area, Budget, Category, Template, Transaction } from './types'

export interface MonthViewInput {
  month: MonthKey
  /** Heutiger Monat und Tag (für die Hochrechnung). */
  today: { month: MonthKey; day: number }
  categories: Category[]
  areas: Area[]
  budgets: Budget[]
  /** Alle Buchungen (auch aus anderen Monaten, für Übertrag und Vergleich). */
  txs: Transaction[]
  templates: Template[]
  ampel: { yellowPct: number; redPct: number }
}

export interface RowView {
  category: Category
  budget: number
  rollover: number
  /** Budget + Übertrag */
  available: number
  actual: number
  /** available − actual (negativ = überschritten) */
  remaining: number
  /** Ausschöpfung in Prozent; null ohne Budget */
  pct: number | null
  /** Nur bei Ausgaben */
  ampel: AmpelResult | null
}

export interface AreaView {
  area: Area
  rows: RowView[]
}

export interface Triple {
  plan: number
  actual: number
  /** Voraussichtlicher Stand am Monatsende; null für künftige Monate */
  forecast: number | null
}

export interface Compare {
  current: number
  /** Vormonat; null, wenn es dort keine Buchungen gab */
  prev: number | null
  /** Durchschnitt der letzten 3 Monate mit Buchungen; null ohne Daten */
  avg3: number | null
}

export interface MonthView {
  phase: 'past' | 'current' | 'future'
  einnahmen: Triple
  ausgaben: Triple
  sparen: Triple
  saldo: Triple
  areas: AreaView[]
  compare: { ausgaben: Compare; einnahmen: Compare }
  /** Die fünf grössten Ausgaben des Monats (Eigenanteil) */
  top: Transaction[]
}

const myCents = (t: Template) =>
  t.shared ? (t.shared.parts.find((p) => p.who === 'me')?.cents ?? 0) : t.amountCents

export function buildMonthView(input: MonthViewInput): MonthView {
  const { month, categories, areas, budgets, templates, ampel: cfg } = input
  const txs = input.txs.filter((t) => !t.deleted)
  const phase =
    month < input.today.month ? 'past' : month > input.today.month ? 'future' : 'current'

  const plan = summarizeBudget(categories, budgets, month)
  const actual = totalsByMonth(txs, categories, month, month)[0]

  // Hochrechnung
  const open = phase === 'current' ? openTemplates(templates, txs, month) : []
  const typeOf = new Map(categories.map((c) => [c.id, c.type]))
  const openSum = (type: Category['type']) =>
    open.filter((t) => typeOf.get(t.categoryId) === type).reduce((s, t) => s + myCents(t), 0)
  const fixIds = categories.filter((c) => c.type === 'ausgabe' && c.fix).map((c) => c.id)
  const fixBooked = fixIds.reduce((s, id) => s + actualForMonth(txs, id, month), 0)
  let fc: { e: number; a: number; s: number } | null = null
  if (phase === 'past') fc = { e: actual.einnahmen, a: actual.ausgaben, s: actual.sparen }
  if (phase === 'current')
    fc = {
      e: actual.einnahmen + openSum('einnahme'),
      a: forecastExpenses({
        month,
        dayOfMonth: input.today.day,
        fixBooked,
        fixOpen: openSum('ausgabe'),
        variableSoFar: actual.ausgaben - fixBooked,
      }),
      s: actual.sparen + openSum('sparen'),
    }

  const rows = categories
    .map<RowView>((category) => {
      const budget = budgetForMonth(budgets, category.id, month)
      const rollover =
        category.type === 'ausgabe' ? rolloverCents(category, month, budgets, txs) : 0
      const act = actualForMonth(txs, category.id, month)
      const available = budget + rollover
      const a =
        category.type === 'ausgabe' ? ampel(act, available, cfg.yellowPct, cfg.redPct) : null
      return {
        category,
        budget,
        rollover,
        available,
        actual: act,
        remaining: available - act,
        pct: available > 0 ? (act / available) * 100 : null,
        ampel: a,
      }
    })
    .filter((r) =>
      r.category.hidden ? r.actual !== 0 : r.budget !== 0 || r.actual !== 0 || r.rollover !== 0,
    )

  const areaViews = [...areas]
    .sort((a, b) => a.order - b.order)
    .map((area) => ({
      area,
      rows: rows
        .filter((r) => r.category.areaId === area.id)
        .sort((a, b) => a.category.order - b.category.order),
    }))
    .filter((a) => a.rows.length > 0)

  // Vergleich mit Vormonat und Durchschnitt
  const window = totalsByMonth(txs, categories, addMonths(month, -12), month)
  const prior = window.slice(0, -1)
  const cmp = (pick: (t: (typeof window)[number]) => number): Compare => ({
    current: pick(window[window.length - 1]),
    prev: pick(prior[prior.length - 1]) || null,
    avg3: averageOfMonths(prior.map(pick), 3),
  })

  const top = txs
    .filter((t) => monthOf(t.date) === month && typeOf.get(t.categoryId) === 'ausgabe')
    .sort((a, b) => b.myAmountCents - a.myAmountCents || (a.date < b.date ? 1 : -1))
    .slice(0, 5)

  return {
    phase,
    einnahmen: { plan: plan.einnahmen, actual: actual.einnahmen, forecast: fc?.e ?? null },
    ausgaben: { plan: plan.ausgaben, actual: actual.ausgaben, forecast: fc?.a ?? null },
    sparen: { plan: plan.sparen, actual: actual.sparen, forecast: fc?.s ?? null },
    saldo: { plan: plan.saldo, actual: actual.saldo, forecast: fc ? fc.e - fc.a - fc.s : null },
    areas: areaViews,
    compare: { ausgaben: cmp((t) => t.ausgaben), einnahmen: cmp((t) => t.einnahmen) },
    top,
  }
}
