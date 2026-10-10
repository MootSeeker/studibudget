/** Einlieferung in den Posteingang über die RPC inbox_insert per fetch (#158), ohne supabase-js. */
import type { ConnectorConfig } from './config'

export type SendResult = 'ok' | 'netzfehler' | 'widerrufen' | { fehler: string }

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

const CODE_WIDERRUFEN = '42501'

export async function inboxInsert(
  config: Pick<ConnectorConfig, 'supabaseUrl' | 'anonKey' | 'token'>,
  proposalId: string,
  ciphertext: string,
  fetchFn: FetchLike,
): Promise<SendResult> {
  const url = config.supabaseUrl + '/rest/v1/rpc/inbox_insert'
  const init = {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: 'Bearer ' + config.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_token: config.token,
      p_proposal_id: proposalId,
      p_ciphertext: ciphertext,
    }),
  }
  let res: Awaited<ReturnType<FetchLike>>
  try {
    res = await fetchFn(url, init)
  } catch {
    return 'netzfehler'
  }
  if (res.ok) return 'ok'
  if (res.status >= 500) return 'netzfehler'
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>
    if (b.code === CODE_WIDERRUFEN) return 'widerrufen'
    if (typeof b.message === 'string') return { fehler: b.message }
  }
  return { fehler: `HTTP ${res.status}` }
}
