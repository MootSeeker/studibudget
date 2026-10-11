---
typ: entscheid
bereich: produkt
status: entschieden
datum: 2026-10-11
aktualisiert: 2026-10-11
repo-quelle:
  - src/pages/einstellungen/useSectionDraft.ts
  - src/pages/einstellungen/UnsavedGuard.tsx
  - src/pages/einstellungen/useUnsaved.ts
  - src/pages/Einstellungen.tsx
tags:
  - typ/entscheid
  - status/entschieden
---

# Einstellungen speichern sofort oder per Knopf, ungespeicherte Änderungen gehen nicht still verloren

**Status: entschieden** (Issues #183 bis #189, ein PR)

## Frage

Die Einstellungsseite speicherte auf drei Arten (sofort, per «Speichern», per «Änderung prüfen»), man sah nicht, was schon gespeichert war, und ein Reiterwechsel verwarf Eingaben still. Dazu übernahmen Abschnitte gespeicherte Werte nur beim ersten Anzeigen: Nach einem Landwechsel überschrieb «Speichern» die neuen Semester mit den alten (#184).

## Optionen

| Option | Verhalten | Kosten |
| --- | --- | --- |
| Alles sofort speichern | kein Entwurf, kein Dialog | Eingaben mit Prüfung (Semester, IBAN) sind halbfertig gespeichert, ungültige Zustände im Backup |
| Alles per Knopf | einheitlich | Wahlfelder wie Hell/Dunkel wirken träge |
| Mischform mit Regel | Wahlfelder sofort, geprüfte Abschnitte per Knopf mit Entwurf | Hook und Dialog nötig |

## Was der Code heute tut

Die App nutzt `HashRouter`; `useBlocker` braucht einen Data-Router. Der Dialog läuft deshalb über `SubNav` (Prop `beforeChange`) und einen Klick-Handler auf Links, dazu `beforeunload` beim Neuladen.

## Entscheid

- **Sofort:** Darstellung, «archiviert», Namen von Personen und Autos, «Hinzufügen».
- **Per Knopf mit Entwurf:** Semester, Ampel, Bankverbindung, Land und Wohnsituation. Zeigt «Nicht gespeichert», solange der Entwurf abweicht.
- `useSectionDraft` folgt den gespeicherten Werten, solange nichts ungespeichert ist; sonst `stale` mit Hinweis, «Speichern» überschreibt nicht still.
- Ein Dialog (Speichern, Verwerfen, Abbrechen) fragt bei Reiter- und Seitenwechsel. Land und Wohnsituation lassen sich nur verwerfen (das Speichern läuft über «Änderung prüfen»).
- Semester: Überlappung und leerer Name sperren das Speichern, Lücken sind nur ein Hinweis (Semesterferien).

## Begründung

Die Regel trennt, was keinen Fehler zulässt (sofort), von dem, was geprüft werden muss (Knopf). Ein ungültig gespeicherter Zustand (leerer Semestername) machte sonst das eigene Backup unbrauchbar.

## Folgen

- Neue Abschnitte mit Knopf nutzen `useSectionDraft` und melden sich mit `useRegisterUnsaved` an. Ohne `UnsavedProvider` tut der Hook nichts, einzelne Abschnitte lassen sich also testen.
- Referenzbilder von Haushalt, Darstellung und Konto ändern sich (Ampel eigener Abschnitt, «Nicht gespeichert»).
- Bekannte Lücke: Ändert sich `settings.living` von aussen (Sync), während Land oder Wohnsituation im Entwurf stehen, kann «Nicht gespeichert» fälschlich erscheinen.

Verwandt: [[Entscheid - Reiter statt langer Seiten]], [[Verschlüsselung und Sync]]
