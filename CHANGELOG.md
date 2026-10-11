# Änderungen

Alle nennenswerten Änderungen an StudiBudget. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Behoben

- Einstellungen: Semester werden geprüft. Ein leerer Name oder zwei Semester, die sich einen Monat teilen, lassen sich nicht speichern (die Meldung nennt Semester und Monat); Monate ohne Semester zeigen nur einen Hinweis. Bisher konnte ein Name aus Leerzeichen gespeichert werden und machte die eigene Sicherung unbrauchbar (#183).
- Einstellungen: Semester, Ampel und Bankverbindung zeigen nach einem Landwechsel oder Sync von einem anderen Gerät die neuen gespeicherten Werte. Bei ungespeicherten Eingaben erscheint ein Hinweis, «Speichern» überschreibt nicht mehr still (#184).
- Statistik: «Ø Ausgaben pro Monat» teilt nur noch durch Monate bis und mit dem laufenden; zukünftige Monate des Zeitraums zählen nicht mehr mit. Liegt der Zeitraum ganz in der Vergangenheit, bleibt der Wert gleich. Die Kachel nennt die Regel, in der Monatsansicht heisst die Beschriftung «Ø letzte 3 Monate mit Werten» (#163).
- Seitentitel: Die Rechnungsseite heisst «Rechnung – StudiBudget» (bisher nur «StudiBudget»). Anmelden, Konto anlegen, Passwort vergessen, Neues Passwort, Datenschutz, Impressum vor der Anmeldung und die Einrichtung haben einen eigenen Titel; nach dem Abmelden bleibt der Titel der letzten Seite nicht mehr stehen (#162).
- Sync: Gleichzeitige Pushes eines Nutzers können beim Pull keine Datensätze mehr überspringen (Advisory-Lock in `push_records`, neue Migration, #48).
- Ausgleich: «Wer schuldet wem?» zeigt den Saldo bis Ende des gewählten Monats; bisher blieb er beim Monatswechsel auf dem Gesamtstand, sodass bereits bezahlte Schulden weiter angezeigt wurden. «Ausgleichen» rechnet weiter mit dem Stand von heute (#76).
- Konten und Sparziele: Die Tabelle «Stände am Monatsende» und der Verlauf lassen sich über ein Dropdown «Zeitraum» wählen (Semester, Halbjahr, Year to date, Jahr, 5 Jahre, Max. Aufnahme). Die Pfeile springen um genau einen Zeitraum weiter, ohne Monate zu überspringen oder doppelt zu zeigen; bisher zeigte die Seite immer 12 Monate und verschob sich um 6 (#112).
- Rechnung: Der QR-Code kodierte Umlaute (zum Beispiel «Zürich», «Müller») nicht als UTF-8, wie es die QR-Rechnung verlangt; eine Banking-App konnte solche Codes nicht richtig lesen. Der Inhalt wird jetzt vor der Anzeige gegen den Standard geprüft. Bei der Beispiel-IBAN aus der Dokumentation warnt die Rechnung, dass der Zahlteil nicht bezahlbar ist (#121).

### Geändert

- Einstellungen: Abschnitte mit «Speichern»-Knopf (Semester, Ampel, Bankverbindung, Land und Wohnsituation) zeigen «Nicht gespeichert». Beim Wechsel des Reiters oder der Seite mit ungespeicherten Änderungen fragt ein Dialog nach (Speichern, Verwerfen, Abbrechen). Darstellung wird wie bisher sofort gespeichert und ist von der Ampel getrennt (#185).
- Einstellungen: Die Bankverbindung erscheint nur bei «WG» und «Mit Partner/in»; eine gespeicherte Bankverbindung bleibt erhalten (#186).
- Passwort ändern: Das neue Passwort muss wiederholt werden; ein gleiches Passwort wie das aktuelle wird abgelehnt (#187).
- Konten und Statistik: Der Vermögensverlauf zeigt neben dem Gesamtvermögen für jedes Konto eine eigene Linie. In der Legende lassen sich die Linien per Kästchen ein- und ausblenden; das Gesamtvermögen ist dicker, solange weitere Linien sichtbar sind. Der Chart erscheint schon ab dem ersten erfassten Stand (bisher ab zwei vollständigen Monaten); die «Veränderung im Zeitraum» braucht weiterhin zwei vollständige Monate (#113).
- Bankverbindung: Die Meldung bei einer abgelehnten IBAN nennt jetzt den Grund (Prüfsumme, Länge mit Zeichenzahl, Land, Zeichen), und das Formular zeigt, welche IBAN bis zum Speichern weiterhin auf der Rechnung steht (#120).

### Hinzugefügt

- Konto: «E-Mail-Adresse ändern» (mit Passwort). Supabase schickt Bestätigungen an beide Adressen. Daten und Schlüssel bleiben nutzbar, weil der Schlüssel beim Anfordern für die neue Adresse neu verpackt wird; bis zur Bestätigung ist keine neue Anmeldung möglich, der Wiederherstellungsschlüssel bleibt der Notausgang (#188).
- Einstellungen: bis zu vier Semester («Semester hinzufügen», «Entfernen»). «Daten zurücksetzen» löscht auf Wunsch nur Buchungen, Kontostände und Ausgleichszahlungen vor einem gewählten Monat (#189).
- KI-Konnektor: Einträge, die eine KI (Claude, ChatGPT) als kleinen Text-Block liefert, lassen sich in der Eingabe einfügen, prüfen, ändern und erst nach Bestätigung buchen; schon erfasste Einträge (auch gelöschte) werden nicht noch einmal gebucht. Dazu gibt es ein festes Vorschlagsformat mit Prüfung (#155, #156).
- KI-Konnektor: verschlüsselter Posteingang mit widerrufbaren Verbindungen in den Einstellungen. Der Server speichert nur Chiffretext; neue Migration `inbox` (#157).
- KI-Konnektor: lokaler MCP-Server für Claude Desktop (`npm run build:mcp`), der Vorschläge auf dem Gerät verschlüsselt und im Posteingang ablegt. Anleitung in `docs/ki-konnektor.md` (#158).
- Rechnung: Zahlteil mit Swiss QR Code (Empfangsschein und Zahlteil, A4) für die Schweiz (CHF), wenn eine gültige
  Bankverbindung hinterlegt ist und ein Betrag offen ist. Der Code entsteht im Browser, ohne Netzwerkzugriff (#106, Teil von #65).
- Community-Standards: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` und `ACCESSIBILITY.md`.
- Einstellungen: neuer Abschnitt «Bankverbindung» im Reiter «Haushalt» mit Kontoinhaber/in, Adresse und IBAN (Schweiz
  oder Liechtenstein, mit Prüfsumme). Alle Angaben sind freiwillig; sie werden verschlüsselt synchronisiert und stehen
  im unverschlüsselten Backup. Grundlage für Rechnungen aus dem Ausgleich (#104, Teil von #65).
- Ausgleich: bei positivem Saldo der Knopf «Rechnung erstellen». Die Rechnung listet die Positionen und bereits erfasste
  Zahlungen, nennt das Total und deine Bankverbindung und lässt sich als A4-Druckansicht drucken oder als PDF speichern
  (#105, Teil von #65).

## [1.3.0] – 2026-10-06

### Hinzugefügt

- Betragsfelder verstehen einfache Rechnungen mit `+`, `-`, `*`, `/`, Klammern und Prozent, zum Beispiel `3500*60%`.
  Gespeichert wird das Ergebnis, auf ganze Rappen/Cent gerundet; ungültige Rechnungen werden wie ein ungültiger Betrag
  abgelehnt (#88).
- Statistik: neuer Abschnitt «Ausgleichszahlungen» mit Chart pro Person und Monat (bezahlt und erhalten) und Tabelle,
  damit man sieht, wie zuverlässig Schulden bezahlt wurden (#78).

### Geändert

- Budget: weniger Scrollen. Vier Reiter (Monatsbudget, Kategorien, Fixkosten, Datei); im Monatsbudget stehen die
  Bereiche eingeklappt mit Anzahl und Summe im Kopf und eine Kategorie braucht nur noch eine Zeile; Bearbeiten steckt im
  Reiter «Kategorien» (#84).
- Einstellungen: gegliedert in die Reiter Haushalt, Darstellung, Daten und Konto (#84).
- Eingabe: die Buchungsliste klappt ihre Bereiche ein, wenn ein Monat mehr als 15 Buchungen hat (#84).
- CI: GitHub-Actions auf Versionen mit Node 24 gehoben (checkout 7, setup-node 7, cache 6, upload-artifact 7,
  download-artifact 8, upload-pages-artifact 5, deploy-pages 5); das beseitigt die Node-20-Warnung und die
  `punycode`/`url.parse`-Hinweise.
- Abhängigkeiten: `glob` (veraltet, mit Sicherheitshinweis) und `qs` (zwei Schwachstellen, nur im Mutationstest-Werkzeug)
  über `overrides` auf aktuelle Versionen; `npm audit` meldet keine Schwachstellen mehr.
- Lint: alle elf Warnungen behoben (Monatsnamen und `saveSettings` in eigene Dateien, `useNow` statt `new Date()` beim
  Zeichnen, kein `setState` im Effekt der Anmeldung).
- Entwicklung: Node-Version steht in `.nvmrc` (24), `engines` verlangt mindestens 24.15; die CI liest die Version von dort (#100).
- Entwicklung: Issue-Formulare mit Akzeptanzkriterien, Pull-Request-Vorlage, `CLAUDE.md` mit Arbeitsablauf, Reviewer-Agent und Skills sowie ein leichter Doku-Workflow; Draft-PRs und reine Doku-Änderungen lösen die schwere CI nicht aus (#90 bis #99).

## [1.2.0] – 2026-10-05

### Hinzugefügt

- Statistik: Abschnitt «Vermögen» mit Verlauf und Veränderung im gewählten Zeitraum (#52).
- Budget: das Budget lässt sich exportieren und aus einer Datei importieren (#30).
- Einstellungen: «Daten zurücksetzen» löscht wahlweise Budget, Buchungen, Fixkosten-Vorlagen,
  Ausgleichszahlungen, Konten, Kontostände und Sparziele, mit Backup-Angebot vorab. Konto, Kategorien und
  Einstellungen bleiben (#30).

### Behoben

- Der Sync startet jetzt auch nach Änderungen bei Konten, Budget-Kategorien, Einrichtung, Backup-Import und
  Katalogwechsel sofort; sie nutzten zuvor einen eigenen Store (#79).

### Geändert

- CI: Docker-Images des lokalen Supabase und Playwright-Browser werden zwischengespeichert, die E2E-Tests laufen
  parallel (#62).

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

[Unreleased]: https://github.com/MootSeeker/studibudget/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/MootSeeker/studibudget/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/MootSeeker/studibudget/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/MootSeeker/studibudget/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/MootSeeker/studibudget/releases/tag/v1.0.0
