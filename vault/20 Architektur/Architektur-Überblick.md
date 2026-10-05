---
typ: referenz
bereich: architektur
status: aktiv
aktualisiert: 2026-10-05
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
- **Ein Schreibweg**: alles läuft über `store` (`put`, `patch`, `remove`, `writeBatch`). `storeFor(db)` liefert für die App-Datenbank immer den gemeinsamen `store`: Nur seine Änderungen stossen den Sync an (`onChange`). Ein eigener Store gilt nur in Tests (Regression #79). `patch` liest den aktuellen Datensatz
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
| Seiten | `src/pages/*` (Budget in `src/pages/budget/`, Einstellungen in `src/pages/einstellungen/`) |
| Reiter, Einklappen | `components/SubNav`, `components/Collapsible`, `lib/useSubNav`, `lib/useOpenSet` |
| Datenbankschema | `supabase/migrations/*` |

## Reiter und Einklappen (#84)

- **Reiter** (`SubNav`): Auswahl steht in der Adresse (`#/budget?ansicht=kategorien`, `#/einstellungen?bereich=daten`); unbekannt oder fehlend = erster Reiter. Links von anderen Seiten können direkt auf einen Reiter zeigen (z. B. der Backup-Hinweis).
- **Einklappen** (`Collapsible` + `useOpenSet`): Kopf ist ein Knopf mit `aria-expanded`; offene Bereiche merkt sich `useOpenSet` in `localStorage` (jeder Zugriff abgesichert). Die Buchungsliste auf «Eingabe» startet bei mehr als 15 Buchungen eingeklappt.
- **Daten zurücksetzen** (`domain/reset.ts`, `data/resetOps.ts`): wählbare Arten, ein `writeBatch`, bereinigt Verweise (Vorlage, Sparziel), damit jedes Backup gültig bleibt.
- **Budget-Datei** (`domain/budgetFile.ts`): Export/Import über Kategoriename und Art, nicht über IDs.
