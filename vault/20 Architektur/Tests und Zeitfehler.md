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

## Test-Aufbau (seit Baustein 1 bis 7)

- **Vitest-Projekte** in `vitest.config.ts`: `unit` (`npm test`), `slow` (`npm run test:slow`), `db` (`npm run test:db`, Docker nötig). Immer mit `--project`.
- **Tags:** `regression`, `property`, `negativ` (`npm run test:regression`, `test:prop`). Regressionstests heissen `… (Regression #N)`.
- **Gemeinsame Helfer** in `src/test/`: `factories`, `fakeServer`, `fakeSupabase`, `supabaseStatus`.
- **Coverage** pro Bereich: Untergrenzen in `scripts/coverage-areas.json`; nach neuen Tests `npm run coverage:ratchet` und committen. `verify` enthält jetzt die Coverage.
- **Konsolen-Wächter** (`src/test/setup.ts`): jede `console.error/warn` im Test lässt ihn scheitern. «not wrapped in act» ist bewusst abgeschaltet (Live-Abfragen); stattdessen `findBy…`/`waitFor`.
- **Fehler, die Tests finden:** Issue mit Label `gefunden-durch-tests`, roter Regressionstest, dann Fix.
- **CI:** Jobs `statisch`, `unit`, `langsam`, `datenbank`, `build`, `bericht` (Zusammenfassung auf der Actions-Seite), `deploy`. Kein Branch-Schutz im Repo.
- **Eigenschaftstests:** `FC_NUM_RUNS` stellt die Zufallsfälle ein (Standard 100).
