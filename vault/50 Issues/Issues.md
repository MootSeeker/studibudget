---
typ: hub
bereich: produkt
status: erledigt
aktualisiert: 2026-10-05
tags:
  - typ/hub
---

# Issues

Alle Issues sind umgesetzt und geschlossen (Stand 2026-10-04). Repo: github.com/MootSeeker/studibudget/issues

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

Weitere Bausteine der Test-Suite: Stryker #58 (PR #59), E2E #60 (PR #61), zwei Geräte #63 (PR #64), axe #66 (PR #67), Bildvergleich #68 (PR #69), Doku und Release #70.

Offen: #48 (Analyse: Lücken in `records_seq` bei gleichzeitigen Pushes), #30 (Budget zurücksetzen, älter).

Entscheide dazu: [[Entscheid - Vorlagen statt Budget im Intervall]], [[Entscheid - Kassensicht beim Ausgleich]].
