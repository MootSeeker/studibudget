import { TransportError, type PullRow, type PushRow, type Transport } from '../sync/transport'

/**
 * Server im Speicher mit derselben Last-Writer-Wins-Regel wie push_records(), dazu gezielte Fehler für Negativtests.
 */
export class FakeServer implements Transport {
  rows = new Map<string, PullRow>()
  seq = 0
  online = true
  /** Schlägt der n-te Aufruf von push() fehl (1 = der erste)? Danach läuft es wieder normal. */
  failPushCall: number | null = null
  /** Wirft beim n-ten Aufruf von pull() einen Fehler dieser Art. */
  failPullCall: { n: number; kind: 'network' | 'auth' | 'other' } | null = null
  /** Ein fehlerhafter Server, der `afterSeq` ignoriert und immer von vorn liefert. */
  ignoreAfterSeq = false
  pushCalls = 0
  pullCalls = 0

  async push(rows: PushRow[]) {
    this.pushCalls++
    if (!this.online) throw new TransportError('network', 'Failed to fetch')
    if (this.failPushCall === this.pushCalls) throw new TransportError('other', 'Serverfehler 500')
    for (const r of rows) {
      const cur = this.rows.get(r.id)
      if (!cur || cur.hlc < r.hlc) this.rows.set(r.id, { ...r, seq: ++this.seq })
    }
  }

  async pull(afterSeq: number, limit: number) {
    this.pullCalls++
    // Schutz für Tests: ein Server, der nie «fertig» meldet, soll den Testlauf nicht endlos beschäftigen.
    if (this.pullCalls > 25) throw new TransportError('network', 'Testabbruch: Endlosschleife')
    if (!this.online) throw new TransportError('network', 'Failed to fetch')
    if (this.failPullCall?.n === this.pullCalls)
      throw new TransportError(this.failPullCall.kind, 'Pull fehlgeschlagen')
    return [...this.rows.values()]
      .filter((r) => this.ignoreAfterSeq || r.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
  }
}
