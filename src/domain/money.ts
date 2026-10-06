import { evaluateExpression } from './amountExpr'
import type { Country } from './types'

const LOCALE: Record<Country, { locale: string; currency: string }> = {
  CH: { locale: 'de-CH', currency: 'CHF' },
  DE: { locale: 'de-DE', currency: 'EUR' },
}

/** Formatiert Rappen/Cent nach Landesformat: «CHF 1’234.50» bzw. «1.234,50 €». */
export function formatMoney(cents: number, country: Country): string {
  const { locale, currency } = LOCALE[country]
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/**
 * Liest eine eingetippte Zahl ("23.50", "23,5", "1'234.50", "1.234,50") als Cent oder eine einfache Rechnung
 * ("3500*60%", "(100+20)*2", siehe `amountExpr.ts`). Gibt null zurück, wenn nichts Sinnvolles erkannt wird.
 * Ein einzelner Betrag wird immer wie bisher gelesen; nur was so nicht lesbar ist, wird als Rechnung versucht.
 */
export function parseAmount(input: string): number | null {
  return parseSingleAmount(input) ?? evaluateExpression(input, parseSingleAmount)
}

/** Liest einen einzelnen Betrag als Cent. */
function parseSingleAmount(input: string): number | null {
  let s = input.replace(/[\s'’]/g, '').replace(/^(CHF|EUR|€)|(CHF|EUR|€)$/gi, '')
  if (!/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const decimalAt = Math.max(lastDot, lastComma)
  let intPart = s
  let frac = ''
  if (decimalAt >= 0) {
    const digitsAfter = s.length - decimalAt - 1
    const sepCount = (s.match(/[.,]/g) ?? []).length
    const bothKinds = lastDot >= 0 && lastComma >= 0
    // Ein einzelnes Trennzeichen mit genau 3 Ziffern danach gilt als Tausendertrenner.
    const isThousands = !bothKinds && (sepCount > 1 || digitsAfter === 3)
    if (!isThousands) {
      if (digitsAfter > 2) return null
      intPart = s.slice(0, decimalAt)
      frac = s.slice(decimalAt + 1)
    }
  }
  // Tausendergruppen bestehen aus genau drei Ziffern («1.234.567»); «1.2.3» ist ein Tippfehler, kein Betrag.
  if (!/^-?(\d*|\d{1,3}([.,]\d{3})+)$/.test(intPart)) return null
  intPart = intPart.replace(/[.,]/g, '')
  if (intPart === '' || intPart === '-') intPart = intPart + '0'
  const cents =
    Number(intPart) * 100 + (intPart.startsWith('-') ? -1 : 1) * Number(frac.padEnd(2, '0') || 0)
  return Number.isSafeInteger(cents) ? cents : null
}
