import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { supabaseInbox } from './inbox'

function fake(error: { message: string } | null = null, data: unknown[] = []) {
  const calls: unknown[][] = []
  const client = {
    from: (table: string) => ({
      select: (cols: string) => ({
        order: (col: string, o: unknown) => ({
          limit: async (n: number) => {
            calls.push(['select', table, cols, col, o, n])
            return { data: error ? null : data, error }
          },
        }),
      }),
      delete: () => ({
        in: async (col: string, ids: string[]) => {
          calls.push(['delete', table, col, ids])
          return { error }
        },
      }),
      insert: async (row: unknown) => {
        calls.push(['insert', table, row])
        return { error }
      },
    }),
    rpc: async (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args])
      return { error }
    },
  }
  return { api: supabaseInbox(client as unknown as SupabaseClient), calls }
}

describe('supabaseInbox (#157)', () => {
  it('AK-2: list liest Verbindung, Vorschlags-ID und Chiffretext', async () => {
    const { api, calls } = fake(null, [{ connection_id: 'c', proposal_id: 'p', ciphertext: 'x' }])
    expect(await api.list()).toEqual([{ connectionId: 'c', proposalId: 'p', ciphertext: 'x' }])
    expect(calls[0]).toEqual([
      'select',
      'inbox',
      'connection_id, proposal_id, ciphertext',
      'created_at',
      { ascending: true },
      500,
    ])
  })

  it('AK-7: remove löscht die Einträge mit diesen IDs', async () => {
    const { api, calls } = fake()
    await api.remove(['p1', 'p2'])
    expect(calls).toEqual([['delete', 'inbox', 'proposal_id', ['p1', 'p2']]])
  })

  it('AK-7: remove ohne IDs ruft den Server nicht auf', async () => {
    const { api, calls } = fake()
    await api.remove([])
    expect(calls).toEqual([])
  })

  it('AK-1: connect legt die Verbindung mit dem Token-Hash an', async () => {
    const { api, calls } = fake()
    await api.connect('c', 'h')
    expect(calls).toEqual([['insert', 'inbox_connections', { id: 'c', token_hash: 'h' }]])
  })

  it('AK-5: revoke ruft inbox_revoke auf', async () => {
    const { api, calls } = fake()
    await api.revoke('c')
    expect(calls).toEqual([['rpc', 'inbox_revoke', { p_connection_id: 'c' }]])
  })

  it('AK-5: Fehler des Servers werden geworfen', async () => {
    const { api } = fake({ message: 'kaputt' })
    await expect(api.list()).rejects.toThrow('kaputt')
    await expect(api.remove(['p'])).rejects.toThrow('kaputt')
    await expect(api.connect('c', 'h')).rejects.toThrow('kaputt')
    await expect(api.revoke('c')).rejects.toThrow('kaputt')
  })
})
