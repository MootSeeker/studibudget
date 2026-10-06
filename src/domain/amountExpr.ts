/**
 * Einfache Rechnungen in Betragsfeldern («3500*60%», «(100+20)*2», Issue #88).
 *
 * Eigener Parser, nie `eval`: Der Text wird in Zeichen zerlegt und nach der Grammatik
 *   Ausdruck := Term (('+' | '-') Term)*
 *   Term     := Wert (('*' | '/') Wert)*
 *   Wert     := '-'? (Zahl | '(' Ausdruck ')') '%'?
 * ausgewertet. Gerechnet wird exakt mit Brüchen (BigInt), erst das Ergebnis wird kaufmännisch auf ganze
 * Rappen/Cent gerundet (halbe weg von null). Ungültiges ergibt `null`, nie eine Ausnahme.
 */

/** Längere Eingaben sind kein Betrag; begrenzt auch die Tiefe der Klammern. */
const MAX_LENGTH = 200

/** Wert in Franken/Euro als Bruch; der Nenner ist immer grösser als 0. */
type Fraction = { n: bigint; d: bigint }

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) [x, y] = [y, x % y]
  return x
}
const make = (n: bigint, d: bigint): Fraction => {
  const g = gcd(n, d) || 1n
  return d < 0n ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g }
}
const add = (a: Fraction, b: Fraction) => make(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Fraction, b: Fraction) => make(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Fraction, b: Fraction) => make(a.n * b.n, a.d * b.d)

type Token = { kind: 'num'; text: string } | { kind: 'op'; text: string }

const NUMBER = /^(?:[0-9][0-9.,'’]*|[.,][0-9][0-9.,'’]*)/

/** Zerlegt den Text; `null`, sobald ein unbekanntes Zeichen vorkommt. */
function tokenize(text: string): Token[] | null {
  const tokens: Token[] = []
  let rest = text
  while (rest.length > 0) {
    const ch = rest[0]
    if (/\s/.test(ch)) {
      rest = rest.slice(1)
    } else if ('+-*/()%'.includes(ch)) {
      tokens.push({ kind: 'op', text: ch })
      rest = rest.slice(1)
    } else {
      const m = NUMBER.exec(rest)
      if (!m) return null
      tokens.push({ kind: 'num', text: m[0] })
      rest = rest.slice(m[0].length)
    }
  }
  return tokens
}

/**
 * Wertet `text` als Rechnung aus und gibt das Ergebnis in Rappen/Cent zurück.
 * `readOperand` liest einen einzelnen Betrag (wie `parseAmount` für einen Einzelbetrag) als Cent oder `null`.
 */
export function evaluateExpression(
  text: string,
  readOperand: (operand: string) => number | null,
): number | null {
  if (text.length > MAX_LENGTH) return null
  const tokens = tokenize(text)
  if (!tokens || tokens.length === 0) return null

  let pos = 0
  let failed = false
  const fail = (): Fraction => {
    failed = true
    return { n: 0n, d: 1n }
  }
  const peek = () => tokens[pos]
  const isOp = (t: Token | undefined, ops: string) => t?.kind === 'op' && ops.includes(t.text)

  function expression(): Fraction {
    let left = term()
    while (!failed && isOp(peek(), '+-')) {
      const op = tokens![pos++].text
      const right = term()
      left = op === '+' ? add(left, right) : sub(left, right)
    }
    return left
  }

  function term(): Fraction {
    let left = value()
    while (!failed && isOp(peek(), '*/')) {
      const op = tokens![pos++].text
      const right = value()
      if (op === '*') left = mul(left, right)
      else if (right.n === 0n) return fail()
      else left = mul(left, make(right.d, right.n))
    }
    return left
  }

  function value(): Fraction {
    let negative = false
    if (isOp(peek(), '-')) {
      negative = true
      pos++
    }
    const t = peek()
    let result: Fraction
    if (t?.kind === 'num') {
      pos++
      const cents = readOperand(t.text)
      if (cents === null) return fail()
      result = make(BigInt(cents), 100n)
    } else if (isOp(t, '(')) {
      pos++
      result = expression()
      if (failed || !isOp(peek(), ')')) return fail()
      pos++
    } else {
      return fail()
    }
    if (isOp(peek(), '%')) {
      pos++
      result = mul(result, make(1n, 100n))
    }
    return negative ? make(-result.n, result.d) : result
  }

  const total = expression()
  if (failed || pos !== tokens.length) return null

  // Franken → Rappen, halbe Rappen weg von null
  const scaled = total.n * 100n
  const abs = scaled < 0n ? -scaled : scaled
  const rounded = (2n * abs + total.d) / (2n * total.d)
  const cents = Number(scaled < 0n ? -rounded : rounded)
  return Number.isSafeInteger(cents) ? cents : null
}
