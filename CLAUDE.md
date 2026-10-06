# StudiBudget

Budgetplanung für Studierende (CH/DE), Browser-App (PWA), offline-first, Ende-zu-Ende-verschlüsselter Sync über Supabase.
Stack: React 19, TypeScript, Vite, Tailwind 4, Dexie (IndexedDB), Supabase, Vitest, Playwright. Repo ist öffentlich (GPL-3.0).

## Projekt-Gedächtnis: `vault/`

Das Wissen zum Projekt liegt im Obsidian-Vault `vault/` (Markdown). **Zu Beginn einer Aufgabe zuerst lesen:**
`vault/Start.md` (Einstieg), `vault/10 Projekt/Offene Punkte.md`, bei Bedarf `20 Architektur`, `30 Entscheide`, `40 Betrieb`,
`50 Issues` und das neueste Journal in `60 Journal`. Regeln: `vault/00 Meta/Vault-Anleitung.md`.

- Im Vault steht das **Warum** (Entscheide, Betrieb, Verlauf), nicht, was im Code oder in `README.md` / `docs/` steht. Dort verlinken statt verdoppeln.
- Nach relevanter Arbeit den Vault nachführen: Journal-Eintrag, `aktualisiert` im Frontmatter, Offene Punkte, neue Entscheide mit Vorlage aus `vault/_Vorlagen`.
- **Der Vault ist öffentlich** (liegt im Repo): nie Schlüssel, Passwörter, Tokens oder persönliche Daten hineinschreiben.

## Befehle

```bash
npm install
npx supabase start          # lokales Supabase (Docker); .env.local aus .env.example, Werte aus `npx supabase status -o env`
npm run dev
npm run verify              # lint + typecheck + Unit mit Coverage + build + check:build; vor jedem Commit
npm run test:slow           # ebenfalls vor dem Commit
npm test                    # Unit    | test:db (braucht Supabase) | test:e2e (Playwright) | test:mutation (Stryker, ~3 h)
```

Weitere Skripte und Testkonzept: `README.md`, `docs/testing.md`.

## Leitplanken (Details: `vault/20 Architektur/`, `docs/entscheidungen.md`)

- Geld als **ganze Rappen/Cent**; Monate `YYYY-MM`, Datum `YYYY-MM-DD`.
- Rechenlogik als **reine Funktionen** in `src/domain/` mit Unit-Tests.
- **Ein Schreibweg:** alles über `store` (`put`, `patch`, `remove`, `writeBatch`); nur der gemeinsame Store stösst den Sync an. `patch` liest in der Transaktion.
- Löschen = Grabstein (`deleted: true`). Neue Felder immer optional (alte Daten und Backups müssen gültig bleiben).
- Verschlüsselung in `src/crypto/`, Sync in `src/sync/`; der Server sieht nie Klartext.
- Texte auf Deutsch in Schweizer Schreibweise (kein ß).
- Rechtstexte (`src/legal/content.ts`, `TODO(human)`) nicht selbst ausfüllen.

## Git-Regeln

1. **Nie als Claude committen.** Commits laufen unter Kevins Git-Identität. Keine `Co-Authored-By`-Zeilen, keine «Generated with Claude»-Hinweise in Commits, PR-Beschreibungen oder Issues (gilt auch, wenn ein Werkzeug solche Zeilen vorschlägt).
2. **Ein PR wird nur abgeschlossen (gemergt), wenn die CI komplett grün ist.** Es gibt keinen Branch-Schutz, die Regel gilt als Vereinbarung. Rote oder fehlende Jobs nicht umgehen: Ursache beheben.
3. **Issues immer mit Labels erstellen**, damit die Übersicht stimmt. Vorhandene Labels zuerst ansehen (`gh label list`), nicht ohne Not neue erfinden. Skill `github-issue-hygiene` beachten, falls sie für dieses Repo gilt.
4. **Wer an einem Issue arbeitet, kommentiert das im Issue** (z. B. «Ich arbeite daran, Branch `…`»), bevor es losgeht. So sieht jede andere Person, dass es belegt ist. Bei Abbruch oder Übergabe ebenfalls kurz kommentieren.

Weitere Regeln:

5. Nie direkt auf `main` committen oder pushen: Branch pro Thema → Pull Request.
6. Merge erst nach Kevins ausdrücklichem OK (zusätzlich zu Regel 2).
7. Kein Force-Push, kein `--no-verify`, keine Hooks oder Signierung umgehen. Historie nicht umschreiben, ohne zu fragen.
8. Vor dem Commit `npm run verify` und `npm run test:slow` (siehe Befehle).
9. PR verknüpft sein Issue (`Closes #123`); Titel und Beschreibung auf Deutsch, Titel mit Issue-Nummer wie in der bisherigen Historie.
10. Ein PR = ein Thema. Keine nebenbei mitgeänderten, unzusammenhängenden Dateien.
11. Nach dem Merge: Branch löschen, lokal `git fetch --prune`.
12. Vault nachführen (Journal, Offene Punkte), wenn ein Issue oder PR abgeschlossen wird.
13. Keine Geheimnisse committen (`.env.local`, Schlüssel, Tokens, Anon-Key-Werte); das Repo ist öffentlich.

Supabase-Migrationen nur als Datei in `supabase/migrations/`, erst `--dry-run`; **vor dem Einspielen auf das echte Projekt nachfragen.**
Releases: Version per PR anheben (`npm version … --no-git-tag-version`), nach dem Merge Tag setzen, `CHANGELOG.md` pflegen.
