# Änderungen

Alle nennenswerten Änderungen an StudiBudget. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Hinzugefügt

- Statistik: Abschnitt «Vermögen» mit Verlauf und Veränderung im gewählten Zeitraum (#52).
- Budget: das Budget lässt sich exportieren und aus einer Datei importieren (#30).
- Einstellungen: «Daten zurücksetzen» löscht wahlweise Budget, Buchungen, Fixkosten-Vorlagen,
  Ausgleichszahlungen, Konten, Kontostände und Sparziele, mit Backup-Angebot vorab. Konto, Kategorien und
  Einstellungen bleiben (#30).

### Behoben

- Der Sync startet jetzt auch nach Änderungen bei Konten, Budget-Kategorien, Einrichtung, Backup-Import und
  Katalogwechsel sofort; sie nutzten zuvor einen eigenen Store (#79).

## [1.1.0] – 2026-10-05

Dieses Release bringt eine umfassende Test-Suite. Die App selbst ändert sich kaum, aber elf Fehler, die die Tests
gefunden haben, sind behoben.

### Hinzugefügt

- Test-Suite mit Vitest-Projekten (`unit`, `slow`, `db`), Tags (`regression`, `property`, `negativ`) und gemeinsamen
  Fabriken in `src/test/` (#32).
- Testberichte, Coverage pro Bereich mit Untergrenze (Ratchet) und eine in Jobs aufgeteilte CI mit Zusammenfassung
  auf der Actions-Seite (#34).
- Supabase-Tests (Zugriffsregeln, Konto, Sync) laufen in der CI gegen ein lokales Supabase (#36).
- Fehlerpfad-Tests für Domain, Backup, Krypto, Sync, Konto und Oberfläche sowie ein strenger Konsolen-Wächter
  (#44, #49, #53).
- Eigenschaftsbasierte Tests mit fast-check, darunter ein modellbasierter Sync-Test mit mehreren Geräten (#56).
- Mutationstests mit Stryker, wöchentlich und auf Abruf (#59).
- Ende-zu-Ende-Tests mit Playwright in Chromium und WebKit: Registrierung, Anmeldung, Passwort vergessen, Buchung,
  Vorlage, geteilte Ausgabe, Backup, Konto (#61), zwei Geräte, Offline und PWA (#64).
- Barrierefreiheitsprüfung mit axe nach WCAG 2.0 bis 2.2 (A und AA), hell und dunkel, Handy und Desktop (#67).
- Visuelle Regression mit 54 Referenzbildern und dem Workflow «Referenzbilder» (#69).

### Geändert

- Scrollbare Tabellen in Monat, Statistik und Konten sind jetzt per Tastatur erreichbar (#67).
- Abmelden leert alle lokalen Tabellen in einer einzigen Transaktion; die Anmeldung ohne lokalen Schlüssel leert den
  lokalen Stand (#61).

### Behoben

- Beträge wie `1.2.3` wurden still als 123.00 gelesen (#38).
- Backup: Vorlagen mit unbekannter Person (#39), Verweise auf gelöschte Datensätze (#40) und doppelte IDs (#41)
  bestanden die Prüfung.
- Backup-Datei wurde vollständig gelesen, bevor ihre Grösse geprüft war (#42).
- Der Kontostand eines gelöschten Kontos blockierte jedes neue Backup (#43).
- Sync: Die Pull-Schleife hatte keine Fortschrittsprüfung (#46).
- Passwort ändern war nicht atomar: Schlug das Speichern der Schlüssel fehl, war das alte Passwort weg und das neue
  unbrauchbar (#47).
- Einstellungen: Zwei Felder «Passwort zur Bestätigung» teilten sich dieselbe ID (#51).
- Sync: Der HLC-Zähler lief über vier Hex-Stellen über, neuere Änderungen verloren (#55).
- WebKit: Nach dem Abmelden blieb ein alter Abgleichsstand zurück, beim nächsten Anmelden fehlten die Daten (#61).

### Sicherheit

- Keine Änderungen.

## [1.0.0] – 2026-10-04

Erste Veröffentlichung.

### Hinzugefügt

- Budgetplanung für Studierende in der Schweiz und in Deutschland: Eingabe, Monat mit Ampel und Prognose, Statistik,
  Budget, Konten und Sparziele, Ausgleich in WG und Partnerschaft, Backup.
- Konto mit Ende-zu-Ende-Verschlüsselung (Daten werden auf dem Gerät verschlüsselt), Wiederherstellungsschlüssel.
- Offline-first mit Sync über mehrere Geräte, installierbar als App (PWA).
- Fixkosten-Vorlagen, Intervalle, Rückstellungs-Hinweis, mehrere Autos, responsives Layout.
- Datenschutzerklärung und Impressum.

[Unreleased]: https://github.com/MootSeeker/studibudget/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/MootSeeker/studibudget/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/MootSeeker/studibudget/releases/tag/v1.0.0
