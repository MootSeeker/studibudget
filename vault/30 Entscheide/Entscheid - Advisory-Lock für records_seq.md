---
typ: entscheid
bereich: sync
status: entschieden
datum: 2026-10-09
aktualisiert: 2026-10-09
repo-quelle:
  - supabase/migrations/20261009000000_push_records_lock.sql
  - src/sync/records-seq.db.test.ts
tags:
  - typ/entscheid
  - status/entschieden
---

# Pushes eines Nutzers laufen nacheinander, damit der Pull keine Zeile überspringt

**Status: entschieden** (Issue #48)

## Frage

`records.seq` wird beim Einfügen gezogen, sichtbar wird die Zeile aber erst beim Commit. Schreibt Push B (seq 6) vor Push A (seq 5) fest und holt ein Gerät dazwischen, merkt es sich `lastSeq = 6` und holt seq 5 nie. Wie schliessen wir die Lücke?

## Optionen

| Option | Verhalten | Kosten |
| --- | --- | --- |
| Pull mit Überlappung | Pull ab `lastSeq - N`; Zeilen sind dank Last-Writer-Wins idempotent | N ist geraten, bei jedem Pull doppelte Zeilen, bei langen Transaktionen bleibt die Lücke möglich |
| Advisory-Lock pro Nutzer | `push_records` nimmt `pg_advisory_xact_lock` auf den Nutzer; Pushes desselben Nutzers laufen nacheinander | Gleichzeitige Pushes eines Nutzers warten aufeinander, andere Nutzer bleiben unberührt |

## Was der Code heute tut

`push_records` zieht `nextval` pro Zeile ohne Sperre (`supabase/migrations/20261003000000_init.sql`). Der Pull in `src/sync/engine.ts` setzt `lastSeq` auf die höchste gelieferte Nummer.

## Entscheid

Advisory-Lock pro Nutzer (Migration `20261009000000_push_records_lock.sql`). Der Test `src/sync/records-seq.db.test.ts` stellt die Lücke deterministisch nach: Eine zweite Verbindung hält eine nicht festgeschriebene Zeile, Push A wartet daran, Push B schreibt fest, dann folgt der Pull.

## Begründung

Der Lock schliesst die Lücke vollständig und braucht keine geratene Fenstergrösse. Bei einer Person mit wenigen Geräten sind Pushes selten gleichzeitig, das Warten ist also kaum spürbar.

## Folgen

- Die Migration ist vor dem Einspielen auf das echte Projekt mit Kevin abzusprechen (zuerst `--dry-run`).
- Der Test braucht `docker` und den Container `supabase_db_studibudget`, wie bei `npx supabase start`.

Verwandt: [[Verschlüsselung und Sync]]
