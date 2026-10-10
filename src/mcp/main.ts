/** Einstieg des StudiBudget-MCP-Servers für Claude Desktop (#158). Gebündelt mit `npm run build:mcp`. */
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { erfasse } from './capture'
import { parseConnectorConfig } from './config'
import { inboxInsert } from './inboxClient'
import { handleMessage, type JsonRpcRequest, type ProtocolContext } from './protocol'

function abbrechen(text: string): never {
  process.stderr.write(text + '\n')
  process.exit(1)
}

const pfad = process.env.STUDIBUDGET_KONFIG
if (!pfad) abbrechen('STUDIBUDGET_KONFIG fehlt: Pfad zur Konfigurationsdatei setzen.')
let text = ''
try {
  text = readFileSync(pfad, 'utf8')
} catch {
  abbrechen('Die Konfigurationsdatei ist nicht lesbar: ' + pfad)
}
const geladen = parseConnectorConfig(text)
if (!geladen.ok) abbrechen(geladen.fehler)
const config = geladen.config

const ctx: ProtocolContext = {
  kategorien: config.kategorien,
  erfasse: (args) =>
    erfasse(args, config, {
      newId: () => crypto.randomUUID(),
      send: (id, ct) => inboxInsert(config, id, ct, fetch),
      warte: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
}

async function verarbeite(zeile: string): Promise<void> {
  if (zeile.trim() === '') return
  let msg: JsonRpcRequest
  try {
    msg = JSON.parse(zeile) as JsonRpcRequest
  } catch {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }) + '\n',
    )
    return
  }
  const antwort = await handleMessage(msg, ctx)
  if (antwort) process.stdout.write(JSON.stringify(antwort) + '\n')
}

createInterface({ input: process.stdin }).on('line', (zeile) => {
  void verarbeite(zeile)
})
