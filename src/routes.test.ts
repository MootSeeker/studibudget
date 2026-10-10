import { describe, expect, it } from 'vitest'
import { ROUTES, titleOf } from './routes'

describe('Routen und Seitentitel', () => {
  it('jede Route des Routers hat einen Titel, auch mit Kennung im Pfad', () => {
    for (const r of ROUTES) {
      const pathname = r.path.replace(/:\w+/g, 'abc-123')
      expect(titleOf(pathname), r.path).toBe(r.title)
      expect(titleOf(pathname)).not.toBe('')
    }
  })
  it('die Rechnungsseite heisst «Rechnung»', () => {
    expect(titleOf('/ausgleich/rechnung/abc')).toBe('Rechnung')
  })
  it('unbekannte Pfade haben keinen Titel', () => {
    expect(titleOf('/gibt-es-nicht')).toBeNull()
  })
})
