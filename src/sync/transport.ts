import type { SupabaseClient } from '@supabase/supabase-js'

export interface PushRow {
  id: string
  hlc: string
  deleted: boolean
  ciphertext: string
}

export interface PullRow extends PushRow {
  seq: number
}

export type TransportErrorKind = 'network' | 'auth' | 'other'

export class TransportError extends Error {
  kind: TransportErrorKind
  constructor(kind: TransportErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface Transport {
  push(rows: PushRow[]): Promise<void>
  pull(afterSeq: number, limit: number): Promise<PullRow[]>
}

function classify(e: { message?: string; code?: string; status?: number }): TransportError {
  const msg = e.message ?? 'Unbekannter Fehler'
  if (/fetch|network|load failed|timeout/i.test(msg) || e.status === 0)
    return new TransportError('network', msg)
  if (e.code === 'PGRST301' || e.code === '42501' || e.status === 401 || /jwt/i.test(msg))
    return new TransportError('auth', msg)
  return new TransportError('other', msg)
}

export function supabaseTransport(sb: SupabaseClient): Transport {
  return {
    async push(rows) {
      const { error } = await sb.rpc('push_records', { rows })
      if (error) throw classify(error)
    },
    async pull(afterSeq, limit) {
      const { data, error } = await sb
        .from('records')
        .select('id, hlc, deleted, ciphertext, seq')
        .gt('seq', afterSeq)
        .order('seq', { ascending: true })
        .limit(limit)
      if (error) throw classify(error)
      return (data ?? []) as PullRow[]
    },
  }
}
