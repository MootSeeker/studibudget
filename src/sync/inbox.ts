import type { SupabaseClient } from '@supabase/supabase-js'

/** Eine Zeile der Server-Tabelle inbox (nur Chiffretext). */
export interface InboxRow {
  connectionId: string
  proposalId: string
  ciphertext: string
}

/** Zugriff der angemeldeten App auf den Posteingang (#157). Fehler werfen ein Error mit der Server-Meldung. */
export interface InboxApi {
  list(): Promise<InboxRow[]>
  remove(proposalIds: string[]): Promise<void>
  connect(connectionId: string, tokenHash: string): Promise<void>
  revoke(connectionId: string): Promise<void>
}

function pruefe(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export function supabaseInbox(sb: SupabaseClient): InboxApi {
  return {
    async list() {
      const { data, error } = await sb
        .from('inbox')
        .select('connection_id, proposal_id, ciphertext')
        .order('created_at', { ascending: true })
        .limit(500)
      pruefe(error)
      return (
        (data ?? []) as { connection_id: string; proposal_id: string; ciphertext: string }[]
      ).map((r) => ({
        connectionId: r.connection_id,
        proposalId: r.proposal_id,
        ciphertext: r.ciphertext,
      }))
    },
    async remove(proposalIds) {
      if (proposalIds.length === 0) return
      const { error } = await sb.from('inbox').delete().in('proposal_id', proposalIds)
      pruefe(error)
    },
    async connect(connectionId, tokenHash) {
      const { error } = await sb
        .from('inbox_connections')
        .insert({ id: connectionId, token_hash: tokenHash })
      pruefe(error)
    },
    async revoke(connectionId) {
      const { error } = await sb.rpc('inbox_revoke', { p_connection_id: connectionId })
      pruefe(error)
    },
  }
}
