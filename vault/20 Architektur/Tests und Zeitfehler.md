---
typ: referenz
bereich: qualitaet
status: aktiv
aktualisiert: 2026-10-04
repo-quelle:
  - docs/entscheidungen.md
  - vitest.slow.config.ts
  - src/test/setup.ts
tags:
  - typ/referenz
---

# Tests und Zeitfehler

`npm run verify` = lint + typecheck + test + build + check:build. Danach `npm run test:slow` (Datenbank künstlich
verlangsamt, einstellbar mit `SLOW_DB=250`). Beides läuft in der CI; ein Deploy geschieht nur auf `main`.

## Warum es das gibt

Auf dem langsameren CI-Rechner liefen mehrfach Tests rot, die lokal grün waren: Sie lasen Werte, bevor die Daten aus
IndexedDB geladen waren. Einmal steckte dahinter ein echter Fehler (Änderungen auf veraltetem Bildschirmzustand).

## Regeln für neue Tests

- Nach `render` nie sofort Werte lesen: `findBy…` oder `waitFor` verwenden, **auch bei Prüfungen, dass etwas fehlt**
  (`expect(…).not.toBeInTheDocument()` ohne Warten besteht zufällig oder scheitert zufällig).
- Mehrere zusammengehörige Prüfungen in ein `waitFor` setzen.
- Vor dem Commit `verify` und `test:slow` ausführen; bei Verdacht mit `SLOW_DB=250` und mehreren parallelen Läufen stressen.
- Ein PR-Lauf, der rot war, nicht als Zufall abtun, auch wenn `main` danach grün ist.
