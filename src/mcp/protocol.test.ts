import { describe, expect, it, vi } from 'vitest'
import { handleMessage, type ProtocolContext } from './protocol'

const GUELTIG = {
  date: '2026-10-09',
  amountCents: 1850,
  categoryName: 'Mittagessen',
  note: 'Mensa',
}
const KATEGORIEN = ['Einkauf zuhause', 'Mittagessen']

function ctx(
  erfasseFn = vi.fn(async (_args: unknown) => ({
    content: [{ type: 'text' as const, text: 'x' }],
    isError: true,
  })),
): ProtocolContext & { erfasse: typeof erfasseFn } {
  return { kategorien: KATEGORIEN, erfasse: erfasseFn }
}

describe('MCP-Protokoll (#158)', () => {
  it('AK-1: antwortet auf initialize mit Werkzeug-Fähigkeit', async () => {
    const r = await handleMessage(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      ctx(),
    )
    expect(r).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'studibudget', version: '1.0.0' },
      },
    })
  })

  it('AK-1: listet das Werkzeug mit den Kategorien', async () => {
    const r = (await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, ctx())) as {
      result: {
        tools: {
          name: string
          description: string
          inputSchema: {
            required: string[]
            properties: { categoryName: { enum: string[] } }
          }
        }[]
      }
    }
    expect(r.result.tools).toHaveLength(1)
    const werkzeug = r.result.tools[0]
    expect(werkzeug.name).toBe('ausgabe_vorschlagen')
    expect(werkzeug.description).toContain('Erlaubte Kategorien: Einkauf zuhause, Mittagessen.')
    expect(werkzeug.inputSchema.required).toEqual(['date', 'amountCents', 'categoryName', 'note'])
    expect(werkzeug.inputSchema.properties.categoryName.enum).toEqual(KATEGORIEN)
  })

  it('AK-1: leitet tools/call an erfasse weiter', async () => {
    const dieses = { content: [{ type: 'text' as const, text: 'x' }], isError: true }
    const erfasseFn = vi.fn(async (_args: unknown) => dieses)
    const r = await handleMessage(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'ausgabe_vorschlagen', arguments: GUELTIG },
      },
      ctx(erfasseFn),
    )
    expect(erfasseFn).toHaveBeenCalledWith(GUELTIG)
    expect(r).toEqual({ jsonrpc: '2.0', id: 2, result: dieses })
  })

  it('AK-1: meldet unbekanntes Werkzeug', async () => {
    const erfasseFn = vi.fn(async (_args: unknown) => ({
      content: [{ type: 'text' as const, text: 'x' }],
      isError: true,
    }))
    const r = await handleMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'loeschen' } },
      ctx(erfasseFn),
    )
    expect(r).toEqual({
      jsonrpc: '2.0',
      id: 5,
      error: { code: -32602, message: 'Unbekanntes Werkzeug: loeschen' },
    })
    expect(erfasseFn).not.toHaveBeenCalled()
  })

  it('AK-1: behandelt tools/call ohne params als unbekanntes Werkzeug', async () => {
    const erfasseFn = vi.fn(async (_args: unknown) => ({
      content: [{ type: 'text' as const, text: 'x' }],
      isError: true,
    }))
    const r = await handleMessage({ jsonrpc: '2.0', id: 4, method: 'tools/call' }, ctx(erfasseFn))
    expect(r).toEqual({
      jsonrpc: '2.0',
      id: 4,
      error: { code: -32602, message: 'Unbekanntes Werkzeug: undefined' },
    })
    expect(erfasseFn).not.toHaveBeenCalled()
  })

  it('AK-1: beantwortet Benachrichtigungen nicht', async () => {
    expect(
      await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx()),
    ).toBeNull()
  })

  it('AK-1: meldet unbekannte Methode', async () => {
    expect(await handleMessage({ jsonrpc: '2.0', id: 3, method: 'resources/list' }, ctx())).toEqual(
      {
        jsonrpc: '2.0',
        id: 3,
        error: { code: -32601, message: 'Methode nicht gefunden: resources/list' },
      },
    )
  })
})
