---
typ: referenz
bereich: architektur
status: aktiv
aktualisiert: 2026-10-04
repo-quelle:
  - docs/entscheidungen.md
  - src/domain/
  - src/data/store.ts
tags:
  - typ/referenz
---

# Architektur-Überblick

Stack: React 19, TypeScript, Vite, Tailwind 4, Dexie (IndexedDB), Supabase (Auth + verschlüsselte Datensätze), PWA via
vite-plugin-pwa. Jede Abhängigkeit ist in `docs/entscheidungen.md` begründet.

## Leitplanken

- **Geld als ganze Rappen/Cent**, Monate `YYYY-MM`, Datum `YYYY-MM-DD`.
- **Rechenlogik als reine Funktionen** in `src/domain/`, mit Unit-Tests.
- **Ein Schreibweg**: alles läuft über `store` (`put`, `patch`, `remove`, `writeBatch`). `patch` liest den aktuellen Datensatz
  _in_ der Transaktion und wendet nur die geänderten Felder an. Schreiben auf einem Bildschirmzustand würde sonst
  schnelle Änderungen gegenseitig überschreiben (siehe [[Tests und Zeitfehler]]).
- **Offline-first**: Die App liest und schreibt lokal; der Sync läuft im Hintergrund ([[Verschlüsselung und Sync]]).
- **Löschen = Grabstein** (`deleted: true`), damit es auf anderen Geräten ankommt.
- **Neue Felder optional**, damit alte Daten und Backups gültig bleiben (z. B. `noReserve`, `skipMonths`, `carId`, Tabelle `cars`).
- **Kontraste** werden aus den CSS-Tokens getestet; die Content-Security-Policy gibt es nur im Build.

## Wo was liegt

| Thema | Ort |
| --- | --- |
| Rechenregeln | `src/domain/*` |
| Datenbank, Store, Backup, Katalog | `src/data/*` |
| Krypto | `src/crypto/*` |
| Sync | `src/sync/*` |
| Seiten | `src/pages/*` |
| Datenbankschema | `supabase/migrations/*` |
