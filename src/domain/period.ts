import type { Country, Semester } from './types'

export type MonthKey = string // YYYY-MM

export function monthOf(date: string): MonthKey {
  return date.slice(0, 7)
}

function parse(m: MonthKey): [number, number] {
  const [y, mo] = m.split('-').map(Number)
  return [y, mo]
}

function key(y: number, mo: number): MonthKey {
  return `${y}-${String(mo).padStart(2, '0')}`
}

/** Aktueller Monat (lokale Zeit) als YYYY-MM. */
export function currentMonth(d: Date = new Date()): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(m: MonthKey, n: number): MonthKey {
  const [y, mo] = parse(m)
  const idx = y * 12 + (mo - 1) + n
  return key(Math.floor(idx / 12), (idx % 12) + 1)
}

/** Alle Monate von `from` bis `to` (beide inklusive). */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = []
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m)
  return out
}

export function daysInMonth(m: MonthKey): number {
  const [y, mo] = parse(m)
  return new Date(y, mo, 0).getDate()
}

export function defaultSemesters(country: Country): Semester[] {
  return country === 'CH'
    ? [
        { name: 'Herbstsemester', startMonth: 8, endMonth: 1 },
        { name: 'Frühjahrssemester', startMonth: 2, endMonth: 7 },
      ]
    : [
        { name: 'Wintersemester', startMonth: 10, endMonth: 3 },
        { name: 'Sommersemester', startMonth: 4, endMonth: 9 },
      ]
}

export interface Period {
  from: MonthKey
  to: MonthKey
  label: string
}

function inSemester(mo: number, s: Semester): boolean {
  return s.startMonth <= s.endMonth
    ? mo >= s.startMonth && mo <= s.endMonth
    : mo >= s.startMonth || mo <= s.endMonth
}

/** Das Semester, das den Monat enthält (auch über den Jahreswechsel). */
export function semesterOf(m: MonthKey, semesters: Semester[]): Period | null {
  const [y, mo] = parse(m)
  const s = semesters.find((x) => inSemester(mo, x))
  if (!s) return null
  const wraps = s.startMonth > s.endMonth
  const startYear = wraps && mo <= s.endMonth ? y - 1 : y
  const endYear = wraps ? startYear + 1 : startYear
  const label = wraps ? `${s.name} ${startYear}/${String(endYear).slice(2)}` : `${s.name} ${y}`
  return { from: key(startYear, s.startMonth), to: key(endYear, s.endMonth), label }
}

export type PeriodKind =
  'semester' | 'studienjahr' | 'halbjahr' | 'jahr' | 'letzte6' | 'letzte12' | 'frei'

/** Löst eine Zeitraum-Auswahl rund um den Referenzmonat in konkrete Monate auf. */
export function resolvePeriod(
  kind: PeriodKind,
  ref: MonthKey,
  semesters: Semester[],
  custom?: { from: MonthKey; to: MonthKey },
): Period {
  const [y, mo] = parse(ref)
  switch (kind) {
    case 'semester':
      return semesterOf(ref, semesters) ?? { from: ref, to: ref, label: ref }
    case 'studienjahr': {
      const startMonth = semesters[0].startMonth
      const startYear = mo >= startMonth ? y : y - 1
      const from = key(startYear, startMonth)
      return {
        from,
        to: addMonths(from, 11),
        label: `Studienjahr ${startYear}/${String(startYear + 1).slice(2)}`,
      }
    }
    case 'halbjahr':
      return mo <= 6
        ? { from: key(y, 1), to: key(y, 6), label: `1. Halbjahr ${y}` }
        : { from: key(y, 7), to: key(y, 12), label: `2. Halbjahr ${y}` }
    case 'jahr':
      return { from: key(y, 1), to: key(y, 12), label: String(y) }
    case 'letzte6':
      return { from: addMonths(ref, -5), to: ref, label: 'Letzte 6 Monate' }
    case 'letzte12':
      return { from: addMonths(ref, -11), to: ref, label: 'Letzte 12 Monate' }
    case 'frei': {
      const c = custom ?? { from: ref, to: ref }
      return { ...c, label: `${c.from} bis ${c.to}` }
    }
  }
}
