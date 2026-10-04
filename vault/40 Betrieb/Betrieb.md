---
typ: referenz
bereich: betrieb
status: aktiv
aktualisiert: 2026-10-04
repo-quelle:
  - .github/workflows/deploy.yml
  - docs/start-checkliste.md
tags:
  - typ/referenz
---

# Betrieb

- **Hosting:** GitHub Pages, Basis `/studibudget/`. Der Workflow `deploy.yml` führt auf PRs und `main` `verify` und
  `test:slow` aus; das Deployment passiert nur auf `main`.
- **Backend:** Supabase-Projekt (Auth + Tabellen `user_keys`, `records`, RPC `push_records`, `delete_account`). Die
  Projekt-URL steht ohnehin öffentlich in der Content-Security-Policy; den Anon-Key liefern GitHub-Variablen
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) beim Build.
- **Migrationen:** immer als Datei in `supabase/migrations/`, erst `--dry-run`, dann `npx supabase db push`. Vor dem Einspielen
  auf das echte Projekt bei Kevin nachfragen.
- **Supabase-Gratisstufe:** pausiert nach längerer Inaktivität; die App läuft lokal weiter, synchronisiert aber nicht.
- **Auth-Mails:** Standardversand begrenzt, vor dem Start eigener SMTP ([[Offene Punkte]]).
- **Releases:** Tag `v1.0.0` plus GitHub-Release.

## Git-Ablauf

Branch pro Thema → Pull Request → Merge nach Kevins OK. Vor dem Commit `verify` und `test:slow`.
