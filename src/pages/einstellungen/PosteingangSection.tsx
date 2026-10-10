import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { buttonClass, inputClass } from '../../auth/ui'
import {
  generateInboxKeyPair,
  hashInboxToken,
  newInboxToken,
  wrapInboxPrivateKey,
} from '../../crypto/inbox'
import { db } from '../../data/db'
import { newId } from '../../data/seed'
import { store } from '../../data/store'
import type { InboxApi } from '../../sync/inbox'
import { Section } from './Sections'

interface NeueVerbindung {
  connectionId: string
  publicKey: string
  token: string
  kategorien: string[]
}

function konfiguration(n: NeueVerbindung): string {
  return JSON.stringify(
    {
      studibudgetPosteingang: 1,
      supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
      anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
      connectionId: n.connectionId,
      publicKey: n.publicKey,
      token: n.token,
      kategorien: n.kategorien,
    },
    null,
    2,
  )
}

/** Verbindungen des KI-Posteingangs einrichten und widerrufen (#157). */
export function PosteingangSection({ api }: { api: InboxApi | null }) {
  const verbindungen = useLiveQuery(
    async () =>
      (await db.inboxConnections.toArray())
        .filter((c) => !c.deleted)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [],
    [],
  )
  const [neu, setNeu] = useState<NeueVerbindung | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  async function einrichten() {
    if (!api) return
    setFehler(null)
    setLaeuft(true)
    try {
      const entry = await db.keystore.get('dek')
      if (!entry) {
        setFehler('Der Datenschlüssel fehlt. Bitte melde dich neu an.')
        return
      }
      const connectionId = newId()
      const pair = await generateInboxKeyPair()
      const token = newInboxToken()
      try {
        await api.connect(connectionId, await hashInboxToken(token))
      } catch {
        setFehler(
          'Die Verbindung konnte nicht eingerichtet werden. Bitte prüfe die Internetverbindung.',
        )
        return
      }
      await store.put('inboxConnections', {
        id: connectionId,
        deleted: false,
        publicKey: pair.publicKey,
        wrappedPrivateKey: await wrapInboxPrivateKey(entry.key, connectionId, pair.privateKey),
        createdAt: new Date().toISOString().slice(0, 10),
      })
      const kategorien = (await db.categories.toArray())
        .filter((c) => !c.deleted && !c.hidden)
        .sort((a, b) => a.order - b.order)
        .map((c) => c.name)
      setNeu({ connectionId, publicKey: pair.publicKey, token, kategorien })
    } finally {
      setLaeuft(false)
    }
  }

  async function widerrufen(id: string) {
    if (!api) return
    if (
      !window.confirm('Verbindung widerrufen? Der MCP-Server kann danach nichts mehr einliefern.')
    )
      return
    setFehler(null)
    try {
      await api.revoke(id)
    } catch {
      setFehler('Der Widerruf ist fehlgeschlagen. Bitte prüfe die Internetverbindung.')
      return
    }
    await store.remove('inboxConnections', id)
    if (neu?.connectionId === id) setNeu(null)
  }

  return (
    <Section title="KI-Posteingang">
      <p className="text-sm text-muted">
        Mit einer Verbindung legt ein Programm auf deinem Computer (der StudiBudget-MCP-Server für
        Claude Desktop) verschlüsselte Vorschläge in deinen Posteingang. Der Server sieht keinen
        Betrag, keine Kategorie und keine Notiz. Gebucht wird erst, wenn du einen Vorschlag unter
        «Eingabe» bestätigst.
      </p>
      <p className="text-sm text-muted">
        Was du einer KI sagst, sieht deren Anbieter. Diese Angaben sind nicht von der
        Verschlüsselung von StudiBudget geschützt.
      </p>
      {!api ? (
        <p>Der Posteingang braucht ein Konto mit Sync.</p>
      ) : (
        <>
          <button
            type="button"
            className={buttonClass}
            disabled={laeuft}
            onClick={() => void einrichten()}
          >
            Verbindung einrichten
          </button>
          {fehler && <p role="alert">{fehler}</p>}
          {neu && (
            <div
              role="region"
              aria-label="Neue Verbindung"
              className="space-y-2 rounded-md border border-border p-3"
            >
              <p className="text-sm">
                Das Token wird nur jetzt angezeigt. Kopiere die Konfiguration in den MCP-Server.
              </p>
              <label className="block text-sm">
                Verbindungs-ID
                <input readOnly className={inputClass} value={neu.connectionId} />
              </label>
              <label className="block text-sm">
                Öffentlicher Schlüssel
                <input readOnly className={inputClass} value={neu.publicKey} />
              </label>
              <label className="block text-sm">
                Token
                <input readOnly className={inputClass} value={neu.token} />
              </label>
              <label className="block text-sm">
                Konfiguration
                <textarea readOnly rows={8} className={inputClass} value={konfiguration(neu)} />
              </label>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1"
                onClick={() => setNeu(null)}
              >
                Fertig
              </button>
            </div>
          )}
          {verbindungen.length === 0 ? (
            <p className="text-sm">Keine Verbindung eingerichtet.</p>
          ) : (
            <ul aria-label="Verbindungen" className="space-y-2">
              {verbindungen.map((c) => (
                <li
                  key={c.id}
                  aria-label={`Verbindung ${c.id.slice(0, 8)}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span>Verbindung vom {c.createdAt.split('-').reverse().join('.')}</span>
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1"
                    onClick={() => void widerrufen(c.id)}
                  >
                    Widerrufen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  )
}
