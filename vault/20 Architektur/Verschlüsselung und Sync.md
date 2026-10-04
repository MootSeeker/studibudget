---
typ: referenz
bereich: architektur
status: aktiv
aktualisiert: 2026-10-04
repo-quelle:
  - src/crypto/
  - src/sync/
  - supabase/migrations/
tags:
  - typ/referenz
---

# Verschlüsselung und Sync

## Verschlüsselung

Alles mit der eingebauten Web Crypto API, ohne Krypto-Bibliothek. Aus Passwort und E-Mail wird per PBKDF2 (600'000
Iterationen) ein Masterschlüssel abgeleitet. Daraus entstehen ein `authSecret` (geht als «Passwort» an Supabase, das echte
Passwort verlässt das Gerät nie) und ein Schlüssel, der den zufälligen Datenschlüssel verpackt. Ein Wiederherstellungsschlüssel
verpackt denselben Datenschlüssel ein zweites Mal. Jeder Datensatz wird mit AES-GCM verschlüsselt, die Datensatz-ID dient als
zusätzlich authentifizierte Daten.

**Folge:** Ohne Passwort _und_ Wiederherstellungsschlüssel sind die Daten unwiederbringlich weg. Der Betreiber sieht nur
E-Mail, Zeitpunkte und Anzahl/Grösse der Datensätze.

## Sync

Hybride logische Uhr (`updatedAt`), Outbox, **Last-Writer-Wins pro Datensatz** auf dem Server (RPC `push_records`).
Auslöser: Anmeldung, App-Start, `online`-Ereignis, alle 60 s bei sichtbarer App, 2 s nach einer Änderung. Gleichzeitiges
Bearbeiten desselben Datensatzes auf zwei Geräten kann eine Version überschreiben; für ein Ein-Personen-Budget akzeptiert.

Die Server-Tabelle `records` kennt keine Tabellennamen der App: neue App-Tabellen (z. B. `cars`) brauchen keine Migration.
Details und Begründungen: `docs/entscheidungen.md`.
