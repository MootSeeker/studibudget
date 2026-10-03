import { describe, expect, it } from 'vitest'
import { firstDuplicate, isDuplicateName } from './persons'

describe('Namen von Personen', () => {
  it('Duplikate ohne Rücksicht auf Gross-/Kleinschreibung und Randleerzeichen', () => {
    expect(isDuplicateName(' anna ', ['Anna', 'Ben'])).toBe(true)
    expect(isDuplicateName('Anni', ['Anna'])).toBe(false)
    expect(isDuplicateName('  ', [''])).toBe(false)
  })
  it('erster doppelter Name einer Liste', () => {
    expect(firstDuplicate(['Anna', 'Ben', ' anna'])).toBe('anna')
    expect(firstDuplicate(['Anna', '', ''])).toBeNull()
    expect(firstDuplicate([])).toBeNull()
  })
})
