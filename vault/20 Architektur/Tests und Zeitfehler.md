---
typ: referenz
bereich: qualitaet
status: aktiv
aktualisiert: 2026-10-05
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

## Test-Aufbau (seit Baustein 1 bis 12)

- **Vitest-Projekte** in `vitest.config.ts`: `unit` (`npm test`), `slow` (`npm run test:slow`), `db` (`npm run test:db`, Docker nötig). Immer mit `--project`.
- **Tags:** `regression`, `property`, `negativ` (`npm run test:regression`, `test:prop`). Regressionstests heissen `… (Regression #N)`.
- **Gemeinsame Helfer** in `src/test/`: `factories`, `fakeServer`, `fakeSupabase`, `supabaseStatus`.
- **Coverage** pro Bereich: Untergrenzen in `scripts/coverage-areas.json`; nach neuen Tests `npm run coverage:ratchet` und committen. `verify` enthält jetzt die Coverage.
- **Konsolen-Wächter** (`src/test/setup.ts`): jede `console.error/warn` im Test lässt ihn scheitern. «not wrapped in act» ist bewusst abgeschaltet (Live-Abfragen); stattdessen `findBy…`/`waitFor`.
- **Fehler, die Tests finden:** Issue mit Label `gefunden-durch-tests`, roter Regressionstest, dann Fix.
- **E2E, axe, Bildvergleich** (Playwright, `e2e/`): Chromium und WebKit; axe und Bilder nur Chromium. Wackler gelten als Fehler. Referenzbilder entstehen im Workflow «Referenzbilder», nicht lokal.
- **Mutationstests** (Stryker): wöchentlich, nicht in der PR-CI.
- **CI:** Jobs `statisch`, `unit`, `langsam`, `datenbank`, `e2e` (Chromium, WebKit), `build`, `bericht` (Zusammenfassung auf der Actions-Seite), `deploy`. Kein Branch-Schutz im Repo.
- **Definition von «fertig»:** `verify` und `test:slow` grün, neue Logik mit Test, ein gefundener Fehler mit Regressionstest. Ausführlich: `docs/testing.md`.
- **Neue Regeln aus den E2E-Tests:** Vor dem Abmelden auf den Sync warten; `wipe()` leert alle Tabellen in einer Transaktion (WebKit, #61).
- **Eigenschaftstests:** `FC_NUM_RUNS` stellt die Zufallsfälle ein (Standard 100).
- **E2E parallel:** `fullyParallel`, in der CI 3 Worker, lokal 1. Jeder Test legt ein eigenes Konto an (`neueAdresse()` mit Zeit, Prozess-ID und Zufall), Mails werden nach Adresse gesucht. Das Anmelde-Limit des lokalen Supabase ist dafür auf 300 angehoben.
- **Sync-Knopf in Tests:** `syncAbwarten` sucht `/^(Synchronisiert|\d+ Änderung(en)? ausstehend)/`; `Änderungen?` hätte «1 Änderung» nie gefunden.
- **Mutationstests:** Ausgangswert 82,26 % (2026-10-05), `break: 80`; je Bereich crypto 92,4, domain 85,2, sync 79,1, data 78,6.
- **Referenzbilder** nur auf dem CI-Runner (Workflow «Referenzbilder», `--update-snapshots=all`; ohne `all` übernimmt Playwright kleine Abweichungen unter der Toleranz nicht). Aufnahmen für Budget-/Einstellungs-Reiter inklusive.
- **axe:** prüft alle Reiter und aufgeklappte Bereiche; aktive Reiter brauchen ausreichenden Kontrast (Vollfarbe `bg-accent text-accent-text`).
- **Auf- und Zuklapp-Zustand** liegt in `localStorage`; `src/test/setup.ts` leert ihn nach jedem Test.
- **Lint:** `oxlint` ohne Warnungen halten (`Date` beim Zeichnen über `useNow`, keine Konstanten aus Komponentendateien exportieren).
