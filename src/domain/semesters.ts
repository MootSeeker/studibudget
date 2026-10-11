import { MONTH_NAMES } from '../lib/months'
import { inSemester } from './period'
import type { Semester } from './types'

/** Höchstens so viele Semester, wie das Backup erlaubt. */
export const MAX_SEMESTERS = 4

export interface SemesterCheck {
  errors: string[]
  gapMonths: number[]
}

const label = (s: Semester, i: number) => (s.name.trim() === '' ? `Semester ${i + 1}` : s.name.trim())

/** Namen zu einer Liste: «A», «A und B», «A, B und C». */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`
}

/** Prüft Namen, Überlappungen und Lücken. Die Monate 1–12 zählen, Jahreswechsel sind erlaubt. */
export function checkSemesters(s: Semester[]): SemesterCheck {
  const errors: string[] = []
  s.forEach((x, i) => {
    if (x.name.trim() === '') errors.push(`Semester ${i + 1}: Der Name fehlt.`)
  })
  const gapMonths: number[] = []
  for (let mo = 1; mo <= 12; mo++) {
    const hits = s.map((x, i) => ({ x, i })).filter(({ x }) => inSemester(mo, x))
    if (hits.length === 0) gapMonths.push(mo)
    if (hits.length > 1)
      errors.push(
        `Der ${MONTH_NAMES[mo - 1]} gehört zu mehreren Semestern (${joinNames(hits.map(({ x, i }) => label(x, i)))}).`,
      )
  }
  return { errors, gapMonths }
}

/** Monatsnamen als Liste: «Januar, Februar». */
export function formatMonths(months: number[]): string {
  return months.map((m) => MONTH_NAMES[m - 1]).join(', ')
}

/** Entfernt überflüssige Leerzeichen an den Namen. */
export function trimSemesters(s: Semester[]): Semester[] {
  return s.map((x) => ({ ...x, name: x.name.trim() }))
}

/** Ein neues Semester nach dem letzten: beginnt im Monat nach dessen Ende (Dezember → Januar). */
export function nextSemester(s: Semester[]): Semester {
  const m = (s[s.length - 1].endMonth % 12) + 1
  return { name: 'Semester ' + (s.length + 1), startMonth: m, endMonth: m }
}
