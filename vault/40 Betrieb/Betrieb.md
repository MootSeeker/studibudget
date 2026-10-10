---
typ: referenz
bereich: betrieb
status: aktiv
aktualisiert: 2026-10-10
repo-quelle:
  - .github/workflows/deploy.yml
  - docs/start-checkliste.md
tags:
  - typ/referenz
---

# Betrieb

- **Hosting:** GitHub Pages, Basis `/studibudget/`. Der Workflow `deploy.yml` führt auf PRs und `main` parallele Jobs aus (statisch, unit mit Coverage, langsam, datenbank mit lokalem Supabase, e2e in Chromium und WebKit, build, bericht); das Deployment passiert nur auf `main` und erst nach allen Jobs.
- **Backend:** Supabase-Projekt (Auth + Tabellen `user_keys`, `records`, RPC `push_records`, `delete_account`). Die
  Projekt-URL steht ohnehin öffentlich in der Content-Security-Policy; den Anon-Key liefern GitHub-Variablen
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) beim Build.
- **Migrationen:** immer als Datei in `supabase/migrations/`, erst `--dry-run`, dann `npx supabase db push`. Vor dem Einspielen
  auf das echte Projekt bei Kevin nachfragen.
- **Supabase-Gratisstufe:** pausiert nach längerer Inaktivität; die App läuft lokal weiter, synchronisiert aber nicht.
- **Auth-Mails:** Standardversand begrenzt, vor dem Start eigener SMTP ([[Offene Punkte]]).
- **Weitere Workflows:** `mutation.yml` (Mutationstests, montags 02:00 UTC und auf Abruf, rund 3 Stunden) und `referenzbilder.yml` (Referenzbilder der visuellen Regression erzeugen, auf Abruf).
- **Pflicht-Checks:** Es gibt keinen Branch-Schutz; vor dem Merge müssen alle Jobs grün sein (Vereinbarung). Ausnahmen: **Draft-PRs** lassen die CI aus (sie läuft, sobald der PR «ready for review» ist) und Änderungen nur an `vault/**`, `docs/**`, `CLAUDE.md`, `.claude/**`, `.github/ISSUE_TEMPLATE/**` und `.github/pull_request_template.md` lösen kein `Deploy` aus. Für Doku und Konfiguration läuft stattdessen der leichte Workflow `doku.yml` (Prettier, gitleaks, lychee, `npm run check:vault`, Prüfung von `.claude/`). Vor dem Merge eines Code-PRs also erst aus dem Draft nehmen und die CI abwarten.
- **Releases:** `v1.0.0` (2026-10-04), `v1.1.0` und `v1.2.0` (2026-10-05), `v1.3.0` (2026-10-06), jeweils Tag plus GitHub-Release mit den Notizen aus `CHANGELOG.md` (`gh release create <Tag> --verify-tag --notes-file <Datei>`); den Tag-Push (`git push origin <Tag>`) erlaubt der Wächter auch von `main` aus. Ablauf: Version per PR anheben (`npm version … --no-git-tag-version`), nach dem Merge Tag auf den Merge-Commit setzen.
- **CI-Zwischenspeicher:** Docker-Images des lokalen Supabase (Tar im Actions-Cache, Schlüssel aus Lock-Datei und `supabase/config.toml`) und Playwright-Browser; Wirkung noch zu messen ([[Offene Punkte]], #62). Kosten: keine, das Repo ist öffentlich.
- **Actions** laufen auf Node 24 (Version aus `.nvmrc`, mindestens 24.15; checkout 7, setup-node 7, cache 6, upload-artifact 7, download-artifact 8, pages 5). Verbleibende `punycode`-/`Buffer()`-Hinweise stammen aus `deploy-pages` und `download-artifact`, nicht aus unserem Code.
- **Abhängigkeiten:** `overrides` für `glob` (^13) und `qs` (^6.16); `npm audit` soll 0 melden.
- **Merge-Einstellungen (seit 2026-10-10):** nur Squash-Merge erlaubt (Merge-Commit und Rebase aus), Commit-Titel = PR-Titel, Commit-Nachricht leer (die PR-Nummer im Titel verweist auf Beschreibung und Verlauf). GitHub löscht den Branch nach dem Merge selbst.
- **Aufräumen:** Remote-Branches löscht GitHub beim Merge; lokal `git fetch --prune` und die lokalen Branches entfernen. `backup-vor-umschreiben` (lokal) ist das Backup von der Historienbereinigung.

## Git-Ablauf

Branch pro Thema → Pull Request → Merge nach Kevins OK. Vor dem Commit `verify` und `test:slow`.
