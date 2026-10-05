---
typ: entscheid
bereich: produkt
status: entschieden
datum: 2026-10-05
aktualisiert: 2026-10-05
repo-quelle:
  - src/components/SubNav.tsx
  - src/components/Collapsible.tsx
  - src/lib/useOpenSet.ts
  - src/pages/Budget.tsx
tags:
  - typ/entscheid
  - status/entschieden
---

# Lange Seiten werden in Reiter und einklappbare Bereiche gegliedert

**Status: entschieden** (Issue #84, «Ewiges Scrollen»)

## Frage

Die Budget-Seite war 7685 px (Desktop) bzw. 10 556 px (Handy) hoch: rund 50 Kategorien mit je zwei Zeilen Steuerung, dazu Vorlagen und Export. Wie lässt sich der Überblick verbessern, ohne Funktionen zu streichen?

## Optionen

| Option | Verhalten | Kosten |
| --- | --- | --- |
| Reiter mit eigener Adresse | Monatsbudget, Kategorien, Fixkosten, Datei; Bereiche einklappbar | neue Bausteine, Tests und Bilder anpassen |
| Eine Seite mit Bearbeiten-Schalter | alles auf einer Seite, Verwalten per Schalter | weniger Umbau, Seite bleibt lang |

## Entscheid

- Reiter für **Budget** (Monatsbudget, Kategorien, Fixkosten, Datei) und **Einstellungen** (Haushalt, Darstellung, Daten, Konto). Die Auswahl steht in der Adresse.
- Im Monatsbudget starten die Bereiche **eingeklappt**; der Kopf zeigt Anzahl und Summe. Der Zustand wird auf dem Gerät gemerkt.
- Die Buchungsliste auf «Eingabe» klappt Bereiche ein, wenn ein Monat mehr als 15 Buchungen hat.
- Verwalten (Umbenennen, Reihenfolge, Ausblenden) steckt hinter «Bearbeiten» pro Kategorie im Reiter «Kategorien».

## Begründung

Die Beträge sind das Tagesgeschäft, das Verwalten von Kategorien selten. Beides getrennt macht das Tagesgeschäft kurz (Budget am Desktop 1320 px, am Handy 1627 px). Adressen pro Reiter erlauben Links wie «Zum Backup».

## Folgen

- Tests wählen zuerst den Reiter und klappen Bereiche auf (`Alle aufklappen`); E2E nutzt `einstellungen(page, bereich)`.
- Aktive Reiter müssen den Kontrast bestehen (axe), siehe [[Tests und Zeitfehler]].
- Neue Bereiche starten nach «Alle aufklappen» zugeklappt, bis man erneut aufklappt.

Verwandt: [[Architektur-Überblick]]
