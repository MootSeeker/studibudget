import { describe, expect, it } from 'vitest'
import { defaultSemesters } from './period'
import { checkSemesters, formatMonths, nextSemester, trimSemesters } from './semesters'

describe('Semester-Prüfung (Issue #183)', () => {
  it('AK-1: leerer Name wird gemeldet', () => {
    const r = checkSemesters([
      { name: '   ', startMonth: 8, endMonth: 1 },
      { name: 'Frühling', startMonth: 2, endMonth: 7 },
    ])
    expect(r.errors).toEqual(['Semester 1: Der Name fehlt.'])
    expect(trimSemesters([{ name: '  Herbst ', startMonth: 8, endMonth: 1 }])[0].name).toBe(
      'Herbst',
    )
  })

  it('AK-2: Überlappung nennt den Monat', () => {
    const r = checkSemesters([
      { name: 'Herbst', startMonth: 8, endMonth: 2 },
      { name: 'Frühling', startMonth: 2, endMonth: 7 },
    ])
    expect(r.errors).toEqual(['Der Februar gehört zu mehreren Semestern (Herbst und Frühling).'])
  })

  it('AK-2: Monat in drei Semestern ergibt einen Fehler mit allen Namen', () => {
    const r = checkSemesters([
      { name: 'A', startMonth: 1, endMonth: 3 },
      { name: 'B', startMonth: 2, endMonth: 4 },
      { name: 'C', startMonth: 2, endMonth: 2 },
    ])
    expect(r.errors).toEqual([
      'Der Februar gehört zu mehreren Semestern (A, B und C).',
      'Der März gehört zu mehreren Semestern (A und B).',
    ])
  })

  it('AK-3: Lücke nennt die Monate', () => {
    const r = checkSemesters([
      { name: 'Herbst', startMonth: 8, endMonth: 12 },
      { name: 'Frühling', startMonth: 2, endMonth: 7 },
    ])
    expect(r.errors).toEqual([])
    expect(r.gapMonths).toEqual([1])
    expect(formatMonths(r.gapMonths)).toBe('Januar')
  })

  it('AK-5: Jahreswechsel und Standard', () => {
    for (const country of ['CH', 'DE'] as const) {
      const r = checkSemesters(defaultSemesters(country))
      expect(r.errors).toEqual([])
      expect(r.gapMonths).toEqual([])
    }
  })

  it('AK-1: neues Semester nach Dezember beginnt im Januar', () => {
    const zwei = [
      { name: 'A', startMonth: 1, endMonth: 6 },
      { name: 'B', startMonth: 7, endMonth: 12 },
    ]
    expect(nextSemester(zwei)).toEqual({ name: 'Semester 3', startMonth: 1, endMonth: 1 })
    const siebenEnde = [
      { name: 'A', startMonth: 1, endMonth: 6 },
      { name: 'B', startMonth: 4, endMonth: 7 },
    ]
    expect(nextSemester(siebenEnde)).toEqual({ name: 'Semester 3', startMonth: 8, endMonth: 8 })
  })
})
