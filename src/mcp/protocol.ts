/** MCP-Protokoll über stdio (#158): JSON-RPC mit initialize, ping, tools/list und tools/call. Ohne SDK-Abhängigkeit. */
import type { ToolResult } from './capture'

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: unknown
}

export interface ProtocolContext {
  kategorien: string[]
  erfasse(args: unknown): Promise<ToolResult>
}

export const TOOL_NAME = 'ausgabe_vorschlagen'
const STANDARD_PROTOKOLL = '2025-06-18'

function alsObjekt(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function werkzeug(kategorien: string[]) {
  return {
    name: TOOL_NAME,
    description:
      'Legt einen Ausgaben-Vorschlag verschlüsselt in den StudiBudget-Posteingang. Gebucht wird erst, wenn die Person ihn in StudiBudget bestätigt. Erlaubte Kategorien: ' +
      kategorien.join(', ') +
      '.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Datum im Format JJJJ-MM-TT' },
        amountCents: {
          type: 'integer',
          description: 'Betrag in Rappen, ganze Zahl grösser 0 (CHF 18.50 = 1850)',
        },
        categoryName: {
          type: 'string',
          enum: kategorien,
          description: 'Name einer erlaubten Kategorie',
        },
        note: {
          type: 'string',
          description: 'Kurze Notiz, höchstens 200 Zeichen, darf leer sein',
        },
      },
      required: ['date', 'amountCents', 'categoryName', 'note'],
      additionalProperties: false,
    },
  }
}

export async function handleMessage(
  msg: JsonRpcRequest,
  ctx: ProtocolContext,
): Promise<Record<string, unknown> | null> {
  if (!('id' in msg) || msg.id === undefined) return null
  const id = msg.id
  const p = alsObjekt(msg.params)
  let result: unknown
  switch (msg.method) {
    case 'initialize':
      result = {
        protocolVersion:
          typeof p.protocolVersion === 'string' ? p.protocolVersion : STANDARD_PROTOKOLL,
        capabilities: { tools: {} },
        serverInfo: { name: 'studibudget', version: '1.0.0' },
      }
      break
    case 'ping':
      result = {}
      break
    case 'tools/list':
      result = { tools: [werkzeug(ctx.kategorien)] }
      break
    case 'tools/call':
      if (p.name !== TOOL_NAME) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Unbekanntes Werkzeug: ' + String(p.name) },
        }
      }
      result = await ctx.erfasse(p.arguments)
      break
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Methode nicht gefunden: ' + msg.method },
      }
  }
  return { jsonrpc: '2.0', id, result }
}
