import type { Settlement, Transaction } from './types'

/**
 * Saldo pro Person aus meiner Sicht, in Cent.
 * Positiv: die Person schuldet mir. Negativ: ich schulde der Person.
 */
export function balances(txs: Transaction[], settlements: Settlement[]): Map<string, number> {
  const bal = new Map<string, number>()
  const add = (id: string, cents: number) => bal.set(id, (bal.get(id) ?? 0) + cents)
  for (const t of txs) {
    if (t.deleted || !t.shared) continue
    if (t.shared.paidBy === 'me') {
      for (const p of t.shared.parts) if (p.who !== 'me') add(p.who, p.cents)
    } else {
      add(t.shared.paidBy, -(t.shared.parts.find((p) => p.who === 'me')?.cents ?? 0))
    }
  }
  for (const s of settlements) {
    if (s.deleted) continue
    add(s.personId, s.direction === 'ich_zahle' ? s.amountCents : -s.amountCents)
  }
  return bal
}
