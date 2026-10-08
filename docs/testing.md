# Tests

Wie StudiBudget getestet wird, wie du die Tests ausführst und was bei einem Fehler zu tun ist.

## Die Ebenen

| Ebene                         | Wofür                                                                               | Befehl                  | Läuft in der CI                       |
| ----------------------------- | ----------------------------------------------------------------------------------- | ----------------------- | ------------------------------------- |
| Unit (Vitest, Projekt `unit`) | Rechenlogik, Krypto, Sync-Engine, Oberfläche mit Testing Library und fake-indexeddb | `npm test`              | Job `unit`                            |
| Eigenschaften (fast-check)    | Regeln, die für alle Eingaben gelten (Geld, HLC, Sync mit mehreren Geräten)         | `npm run test:prop`     | in `unit`                             |
| Langsam (Projekt `slow`)      | Dieselben Tests mit künstlich verlangsamter Datenbank: findet Zeitfehler            | `npm run test:slow`     | Job `langsam`                         |
| Datenbank (Projekt `db`)      | Zugriffsregeln, Konto, Sync gegen ein echtes lokales Supabase                       | `npm run test:db`       | Job `datenbank`                       |
| Ende-zu-Ende (Playwright)     | Die ganze App im Browser: Abläufe, zwei Geräte, Offline, PWA                        | `npm run test:e2e`      | Job `e2e` (Chromium, WebKit)          |
| Barrierefreiheit (axe)        | WCAG 2.0 bis 2.2, A und AA, hell/dunkel, Handy/Desktop                              | in `test:e2e`           | Job `e2e` (nur Chromium)              |
| Visuelle Regression           | Vergleich mit Referenzbildern                                                       | in `test:e2e`           | Job `e2e` (nur Chromium)              |
| Mutationstests (Stryker)      | Prüft, ob die Tests Fehler im Code bemerken                                         | `npm run test:mutation` | Workflow `mutation.yml` (wöchentlich) |

Je tiefer die Ebene, desto weniger Tests und desto näher an der echten App. Fehler gehören auf die tiefstmögliche Ebene.

## Vor dem Commit

```bash
npm run verify       # Lint, Typen, Tests mit Coverage, Build, Build-Prüfung
npm run test:slow    # Zeitfehler
```

`test:db` und `test:e2e` brauchen Docker und `npx supabase start`. Ohne Docker laufen sie nur in der CI.

## Konventionen

- **Tags:** `regression`, `property`, `negativ` (`npm run test:regression`, `test:prop`). Regressionstests heissen
  `… (Regression #N)` mit der Nummer des Issues.
- **Fabriken und Helfer** liegen in `src/test/` (`factories`, `fakeServer`, `fakeSupabase`, `supabaseStatus`). Keine
  eigenen Testdaten von Hand zusammenbauen, wenn es eine Fabrik gibt.
- **Zeitfehler:** Nach `render` nie sofort Werte lesen. `findBy…` oder `waitFor` verwenden, auch bei Prüfungen, dass etwas
  fehlt. Zusammengehörige Prüfungen in ein `waitFor`. Ein roter PR-Lauf ist kein Zufall (siehe «Tests und Zeitfehler» im Vault).
- **Konsolen-Wächter** (`src/test/setup.ts`): Jede `console.error` oder `console.warn` im Test lässt ihn scheitern.
- **Coverage:** Untergrenzen pro Bereich in `scripts/coverage-areas.json`. Nach neuen Tests `npm run coverage:ratchet`
  und die Datei committen. Untergrenzen werden nur angehoben.
- **E2E:** Jeder Test legt sein eigenes Konto an (`e2e/support/konto.ts`) und räumt es auf. Ein Test, der erst im zweiten
  Versuch grün wird, gilt als Fehler (`--fail-on-flaky-tests`).
- **Barrierefreiheit:** Ausnahmen gehören in `AUSNAHMEN` in `e2e/barrierefreiheit.spec.ts` und tragen eine Issue-Nummer.

## Wenn ein Test einen Fehler findet

1. Issue anlegen mit dem Label `gefunden-durch-tests`.
2. Roten Regressionstest schreiben (`… (Regression #N)`), der den Fehler beweist.
3. Fehler beheben, bis der Test grün ist.
4. Im PR das Issue schliessen (`Closes #N`).

## Berichte lesen

- Auf der Actions-Seite eines Laufs steht die **Zusammenfassung** (Job `bericht`): Tests, Coverage pro Bereich.
- Je Job gibt es ein Artefakt `bericht-…`. Die E2E-Berichte (`bericht-e2e-chromium`, `bericht-e2e-webkit`) enthalten den
  HTML-Bericht, Screenshots und Traces fehlgeschlagener Tests. Traces öffnet man mit `npx playwright show-trace trace.zip`.
- Die axe-Verstösse hängen als `axe-verstoesse.json` am jeweiligen Test (im HTML-Bericht).
- Mutationstests: Artefakt `bericht-mutation` mit HTML- und JSON-Bericht. Überlebende Mutanten zeigen Lücken in den Tests.

## Referenzbilder erneuern

Die Referenzbilder in `e2e/referenz/` sind nur auf dem CI-Runner verbindlich (Schrift und Rasterung weichen auf anderen
Systemen ab). Schlägt in der CI der Bildvergleich fehl, steht in der Zusammenfassung des Jobs `e2e (chromium)` ein Hinweis
mit dieser Anleitung. Nach einer gewollten Änderung der Oberfläche:

1. Auf GitHub unter Actions den Workflow **Referenzbilder** auf dem Branch starten und das Ende abwarten.
2. Lokal `npm run referenzbilder` ausführen (oder `npm run referenzbilder -- <Branch>`). Das Skript lädt das Artefakt des
   letzten erfolgreichen Laufs mit der GitHub-CLI `gh` und ersetzt `e2e/referenz/`. Es warnt, wenn der Lauf nicht zum
   aktuellen Stand des Branches gehört; dann den Workflow nach dem letzten Push neu starten.
3. Die Bilder im Diff ansehen, dann committen und pushen. Die CI committet nie selbst.

## Sammelstatus der CI

Der Job `ci-gesamt` im Workflow «Deploy» ist nur grün, wenn jeder Pflichtjob (`statisch`, `unit`, `langsam`, `datenbank`,
`e2e`, `build`) grün ist; rot, abgebrochen und übersprungen zählen als Fehler. `gh pr checks` zeigt ihn als eigene Zeile.
Wer einen Pflichtjob ergänzt, trägt ihn in `needs` von `ci-gesamt` ein (`src/test/ci.test.ts` prüft das). Reine
Doku-Änderungen lösen nur den Workflow «Doku» aus, dort gibt es `ci-gesamt` nicht; dessen Prüfungen (format, links, vault, geheimnisse,
`claude-konfiguration`) laufen auch in gemischten PRs und zählen nicht zu `ci-gesamt`.

## Zeitregeln für Tests

`npm run check:zeit` (Teil von `verify`) lässt Tests scheitern, die `new Date()` oder `Date.now()` ohne feste Uhr
verwenden: Datei und Zeile stehen in der Meldung. Zulässig ist eine feste Uhr im selben Test oder dateiweit vor dem ersten Test bzw. in `beforeEach`/`beforeAll` (`vi.setSystemTime`; dazu
`vi.useFakeTimers({ toFake: ['Date'] })`, damit `waitFor` und Timer echt bleiben; danach `vi.useRealTimers()`) oder ein
Eintrag mit Begründung in `scripts/zeit-ausnahmen.json`. Nicht mehr nötige Ausnahmen meldet das Skript ebenfalls.

## Lokal mit Supabase arbeiten

```bash
npx supabase start          # braucht Docker
npm run test:db
npm run test:e2e            # baut die App und startet sie auf Port 4173
```

Mails landen im Mail-Fänger unter http://127.0.0.1:54324; die E2E-Tests lesen sie von dort.

## Mutationstests

`npm run test:mutation` mutiert `src/{domain,crypto,sync,data}/**` und dauert etwa 3 Stunden. In der CI läuft er
montags und auf Abruf (`workflow_dispatch` von `mutation.yml`); der inkrementelle Zwischenstand wird zwischengespeichert.
Ausgangswert (voller Lauf vom 2026-10-05, 3258 Mutanten): **82,26 %**. Der Lauf bricht ab, wenn der Score unter
`break: 80` fällt (Ausgangswert minus 2). Nach Bereich: `src/crypto` 92,4 %, `src/domain` 85,2 %, `src/sync` 79,1 %,
`src/data` 78,6 %. Die meisten überlebenden Mutanten stecken in `src/data/hooks.ts` (134, von keinem Unit-Test erfasst),
`src/domain/period.ts` (38) und `src/domain/monthView.ts` (36).

## Bekannte Eigenheiten

- `de-CH` gibt je nach Node-Version `’` oder `'` als Tausendertrennzeichen aus. Die CI nutzt Node 24; Tests, die Zahlen
  vergleichen, normalisieren das.
- Es gibt keinen Branch-Schutz im Repository; die Pflicht zur grünen CI vor dem Merge ist eine Vereinbarung.
