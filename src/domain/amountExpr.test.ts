import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseAmount } from './money'

// Einfache Rechnungen in Betragsfeldern (Issue #88). Geprüft wird über parseAmount, weil alle Betragsfelder dort lesen.

describe('Rechnen in Betragsfeldern: Grundrechenarten (AK-1)', () => {
  it.each([
    ['3500*60%', 210000],
    ['10+5', 1500],
    ['100-30', 7000],
    ['12*3', 3600],
    ['90/3', 3000],
    [' 3500 * 60% ', 210000],
    ["1'000+500", 150000],
    ['1.234,50+0.50', 123500],
    ['-5+3', -200],
    ['5*-2', -1000],
  ])('«%s» ergibt %i Cent', (input, cents) => {
    expect(parseAmount(input)).toBe(cents)
  })
})

describe('Rechnen in Betragsfeldern: Reihenfolge und Klammern (AK-2)', () => {
  it.each([
    ['100+20*2', 14000],
    ['(100+20)*2', 24000],
    ['100-20-30', 5000],
    ['100/10/2', 500],
    ['2*(3+4)*5', 7000],
    ['((2+3))*4', 2000],
  ])('«%s» ergibt %i Cent', (input, cents) => {
    expect(parseAmount(input)).toBe(cents)
  })
})

describe('Rechnen in Betragsfeldern: Prozent und Dezimalfaktoren (AK-3)', () => {
  it.each([
    ['60%', 60],
    ['3500*60%', 210000],
    ['3500*0.6', 210000],
    ['3500*0,6', 210000],
    ['3500+10%', 350010], // Prozent ist ein Hundertstel, keine Aufschlagsrechnung; Aufschlag: 3500*1.1
    ['3500*1.1', 385000],
  ])('«%s» ergibt %i Cent', (input, cents) => {
    expect(parseAmount(input)).toBe(cents)
  })
})

describe('Rechnen in Betragsfeldern: Runden (AK-4)', () => {
  it.each([
    ['100/3', 3333],
    ['200/3', 6667],
    ['10/4', 250],
    ['0.05*0.5', 3], // 2.5 Rappen: halbe Rappen weg von null
    ['-0.05*0.5', -3],
    ['0.1+0.2', 30], // exakt gerechnet, keine Gleitkommafehler
    ['1/3*3', 100],
  ])('«%s» ergibt %i Cent', (input, cents) => {
    expect(parseAmount(input)).toBe(cents)
  })
})

describe('Rechnen in Betragsfeldern: Sicherheit (AK-8)', () => {
  it('Der Auswerter benutzt weder eval noch new Function', () => {
    const source = readFileSync('src/domain/amountExpr.ts', 'utf8')
    expect(source).not.toMatch(/\beval\s*\(/)
    expect(source).not.toMatch(/new\s+Function\b/)
    expect(source).not.toMatch(/\bFunction\s*\(/)
  })

  it('Programmtext wird nicht ausgeführt, sondern abgelehnt', () => {
    expect(parseAmount('alert(1)')).toBeNull()
    expect(parseAmount('process.exit()')).toBeNull()
    expect(parseAmount('constructor')).toBeNull()
  })
})
