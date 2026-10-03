import { buttonClass } from '../../auth/ui'
import { useInstall } from '../../lib/install'
import { Section } from './Sections'

/** Hinweis zur Installation als App (läuft dann in eigenem Fenster und offline). */
export function InstallSection() {
  const install = useInstall()
  return (
    <Section title="Als App installieren">
      {install.installed ? (
        <p className="text-sm">StudiBudget ist als App installiert.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Als App öffnet sich StudiBudget in einem eigenen Fenster und funktioniert auch ohne
            Internet. Deine Eingaben werden dann synchronisiert, sobald du wieder online bist.
          </p>
          {install.canPrompt && (
            <button className={buttonClass} onClick={() => void install.install()}>
              App installieren
            </button>
          )}
          {install.ios && (
            <p className="text-sm">
              Auf dem iPhone oder iPad: Tippe in Safari auf «Teilen» und dann auf «Zum
              Home-Bildschirm».
            </p>
          )}
          {!install.canPrompt && !install.ios && (
            <p className="text-sm text-muted">
              Im Browser-Menü findest du «App installieren» bzw. «Zum Startbildschirm hinzufügen»,
              falls dein Browser es anbietet.
            </p>
          )}
        </>
      )}
    </Section>
  )
}
