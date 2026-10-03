/**
 * Gerüst für Datenschutzerklärung und Impressum.
 *
 * WICHTIG: Das sind KEINE Rechtstexte. Sie müssen vom Betreiber verfasst oder prüfen gelassen werden, bevor sich andere
 * Personen registrieren (siehe docs/start-checkliste.md). Jeder Abschnitt trägt eine TODO(human)-Markierung; solange eine
 * davon im Text steht, zeigt die Seite den Hinweis «Entwurf», und `npm run check:launch` schlägt fehl.
 */
export interface LegalSection {
  title: string
  /** Was der Betreiber hier ergänzen muss. Entfällt, sobald der Abschnitt ausgefüllt ist. */
  todo?: string
  /** Der fertige Text des Betreibers. */
  body?: string[]
}

export interface LegalDoc {
  slug: 'datenschutz' | 'impressum'
  title: string
  intro?: string
  sections: LegalSection[]
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'datenschutz',
    title: 'Datenschutz',
    sections: [
      {
        title: 'Wer ist verantwortlich?',
        todo: 'TODO(human): Name und Kontakt des Betreibers eintragen.',
      },
      {
        title: 'Welche Daten werden verarbeitet?',
        todo: 'TODO(human): Konto-Daten, verschlüsselte Budgetdaten, Server-Protokolle, Hosting beschreiben. Technische Fakten dazu stehen in docs/start-checkliste.md.',
      },
      {
        title: 'Wozu und auf welcher Grundlage?',
        todo: 'TODO(human): Zwecke und Rechtsgrundlagen festlegen (Prüfung durch eine Fachperson empfohlen).',
      },
      {
        title: 'Wer bekommt die Daten (Auftragsverarbeiter)?',
        todo: 'TODO(human): Hoster der Seite, Datenbank-Anbieter und E-Mail-Anbieter nennen, inklusive Standort.',
      },
      {
        title: 'Wie lange werden die Daten gespeichert?',
        todo: 'TODO(human): Speicherdauer und Löschung festlegen (Konto löschen entfernt die Daten auf dem Server).',
      },
      {
        title: 'Deine Rechte',
        todo: 'TODO(human): Auskunft, Berichtigung, Löschung, Datenübertragbarkeit (Backup-Datei) und Beschwerderecht beschreiben.',
      },
      { title: 'Kontakt für Datenschutzfragen', todo: 'TODO(human): E-Mail-Adresse eintragen.' },
    ],
  },
  {
    slug: 'impressum',
    title: 'Impressum',
    intro:
      'Welche Angaben Pflicht sind, hängt davon ab, wo und wie die App betrieben wird. Bitte kläre das vor dem Start.',
    sections: [
      { title: 'Betreiber', todo: 'TODO(human): Name und Anschrift eintragen.' },
      {
        title: 'Kontakt',
        todo: 'TODO(human): E-Mail-Adresse (und falls nötig Telefon) eintragen.',
      },
      {
        title: 'Weitere Pflichtangaben',
        todo: 'TODO(human): Je nach Land und Betriebsform ergänzen, sonst diesen Abschnitt streichen.',
      },
    ],
  },
]

/** Alle Stellen, die noch ausgefüllt werden müssen. */
export const openTodos = (docs: LegalDoc[] = LEGAL_DOCS): string[] =>
  docs.flatMap((d) => d.sections.filter((s) => s.todo).map((s) => `${d.title}: ${s.title}`))
