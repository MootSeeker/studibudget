import { useEffect, type ReactNode } from 'react'
import { Card, buttonClass } from '../auth/ui'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { completeOnboarding } from '../data/onboarding'
import { useSync } from '../sync/SyncProvider'
import { requestPersistentStorage } from '../lib/storage'
import { applyTheme } from '../theme'
import { Wizard } from './Wizard'

/**
 * Zeigt den Einrichtungsassistenten, solange die Einstellungen fehlen. Vorher wird einmal mit dem Server
 * abgeglichen: Wer sich auf einem neuen Gerät anmeldet, hat seine Einstellungen bereits im Konto.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const sync = useSync()
  const theme = settings?.theme
  const done = settings?.onboardingDone === true

  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])

  // Der Browser soll die Daten nicht bei Platzmangel löschen dürfen.
  useEffect(() => {
    if (done) void requestPersistentStorage()
  }, [done])

  if (settings === undefined) return <p className="p-8 text-muted">Lädt …</p>
  if (settings?.onboardingDone) return <>{children}</>

  if (!sync.hasSynced) {
    const failed = sync.status.state === 'offline' || sync.status.state === 'error'
    return (
      <Card title={failed ? 'Keine Verbindung' : 'Deine Daten werden geladen …'}>
        {failed ? (
          <>
            <p className="text-sm">
              {sync.status.state === 'error' && sync.status.message
                ? sync.status.message
                : 'Beim ersten Start braucht StudiBudget kurz eine Verbindung, um zu prüfen, ob dein Konto schon Daten hat.'}
            </p>
            <button className={buttonClass} onClick={sync.syncNow}>
              Nochmals versuchen
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">Einen Moment bitte.</p>
        )}
      </Card>
    )
  }

  return <Wizard onFinish={(input) => completeOnboarding(db, input)} />
}
