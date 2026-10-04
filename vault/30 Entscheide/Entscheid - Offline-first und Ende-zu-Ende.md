---
typ: entscheid
bereich: architektur
status: entschieden
datum: 2026-09
aktualisiert: 2026-10-04
repo-quelle:
  - docs/entscheidungen.md
tags:
  - typ/entscheid
  - status/entschieden
---

# Konto mit Ende-zu-Ende-Verschlüsselung statt reiner Lokal-App

**Status: entschieden**

## Frage

Wo liegen die Daten, und wer kann sie sehen? Kevin wollte nichts annehmen und fragte ausdrücklich, ob Dritte die Eingaben sehen.

## Optionen

| Option | Verhalten | Preis |
| --- | --- | --- |
| Nur lokal | Daten bleiben im Browser | kein Sync, Verlust bei Gerätewechsel |
| Konto + Klartext-Sync | bequem | Betreiber sieht alle Beträge |
| Konto + Ende-zu-Ende | Server sieht nur Chiffretext | verlorenes Passwort _und_ Schlüssel = Daten weg |

## Entscheid

Konto Pflicht, Registrierung offen für alle, **Ende-zu-Ende**, Supabase (EU), Wiederherstellungsschlüssel bei der
Registrierung. Lokale Kopie unverschlüsselt (angemeldet bleiben), Abmelden löscht sie. Siehe [[Verschlüsselung und Sync]].
