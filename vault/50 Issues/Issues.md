---
typ: hub
bereich: produkt
status: erledigt
aktualisiert: 2026-10-08
tags:
  - typ/hub
---

# Issues

Stand 2026-10-08. Repo: github.com/MootSeeker/studibudget/issues. Offen: #48, #62, #72, #76, #111 bis #113 (siehe [[Offene Punkte]]).

| # | Titel | Umsetzung | PR |
| --- | --- | --- | --- |
| 16 | Autos | Auto pro Buchung und Vorlage, Verwaltung in den Einstellungen; kein Budget/keine Statistik pro Auto | #20 |
| 17 | Layout | Breitere Seiten, einklappbare Seitenleiste, zweispaltige Eingabe, Bedienflächen | #21 |
| 18 | Einnahmen und Ausgaben | Intervalle, Wiederholen im Formular, Rückstellungs-Hinweis | #19 |
| 23 | Fixkosten-Planung | Fixkosten auch für künftige Monate buchen | #26 |
| 24 | Offene Buchungen | Offene Fixkosten pro Monat überspringen; Löschen fragt nach dem Überspringen | #26 |
| 25 | Ausgleichsseite | Monatsansicht, erhalten/bezahlt/neu offen, echtes Defizit | #27 |

## Von den Tests gefunden (Label `gefunden-durch-tests`)

| # | Fehler | PR |
| --- | --- | --- |
| 38 | `1.2.3` wurde als 123.00 gelesen | #44 |
| 39 | Backup: Vorlage mit unbekannter Person | #44 |
| 40 | Backup: Verweise auf gelöschte Zeilen | #44 |
| 41 | Backup: doppelte IDs | #44 |
| 42 | Backup-Datei vor der Grössenprüfung gelesen | #44 |
| 43 | Verwaister Kontostand blockiert Backups | #44 |
| 46 | Pull-Schleife ohne Fortschrittsprüfung | #49 |
| 47 | Passwort ändern nicht atomar | #49 |
| 51 | Doppelte Feld-IDs in den Einstellungen | #53 |
| 55 | HLC-Zähler läuft über | #56 |

Weitere Bausteine der Test-Suite: Stryker #58 (PR #59), E2E #60 (PR #61), zwei Geräte #63 (PR #64), axe #66 (PR #67), Bildvergleich #68 (PR #69), Doku und Release #70 (PR #71).

## Nach `v1.1.0`

| # | Titel | Umsetzung | PR |
| --- | --- | --- | --- |
| 52 | Vermögen in der Statistik | Abschnitt «Vermögen» mit Verlauf und Veränderung | #74 |
| 30 | Budget zurücksetzen, exportieren, importieren | Export/Import (Budget-Seite), «Daten zurücksetzen» mit Auswahl (Einstellungen) | #74, #77 |
| 79 | Sync startet nach manchen Änderungen nicht sofort | `storeFor(db)`, gemeinsamer Store als Standard | #80 |
| 62 | CI dauert lange | teilweise: Zwischenspeicher und parallele E2E-Tests; offen bis gemessen | #81 |
| 84 | Ewiges Scrollen | Reiter, einklappbare Bereiche, Einstellungen in Reitern | #85 |
| 104 | Bankverbindung | Einstellungen, IBAN CH/LI mit Prüfsumme | #107 |
| 105 | Rechnung mit Positionen | Druckansicht `/ausgleich/rechnung/:personId` | #108 |
| 65 | Ausgleichsrechnungen | Sammel-Issue, geschlossen am 2026-10-08; Teile #104 bis #106 | – |
| 106 | Swiss QR Code | Zahlteil unter der Rechnung, Typ S, Zahlungspflichtiger leer | #114 |

Weitere Änderungen ohne Issue: Version 1.2.0 (#82), CI-Warnungen und veraltete Pakete (#83), PWA-Test-Fix (#75).

Offen: #48 (Analyse: Lücken in `records_seq` bei gleichzeitigen Pushes), #30 (Budget zurücksetzen, älter).

Entscheide dazu: [[Entscheid - Vorlagen statt Budget im Intervall]], [[Entscheid - Kassensicht beim Ausgleich]].
