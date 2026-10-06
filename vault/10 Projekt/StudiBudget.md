---
typ: hub
bereich: produkt
status: aktiv
aktualisiert: 2026-10-06
repo-quelle:
  - README.md
tags:
  - typ/hub
---

# StudiBudget

Einfache Budgetplanung für Studierende in der Schweiz (CHF) und Deutschland (EUR). Browser-App (PWA), Deutsch in
Schweizer Schreibweise, Konto mit Ende-zu-Ende-Verschlüsselung und Sync, offline nutzbar.

- **Repo:** github.com/MootSeeker/studibudget (öffentlich, GPL-3.0)
- **App:** https://mootseeker.github.io/studibudget/
- **Stand:** Version 1.3.0 (Tag `v1.3.0`, 2026-10-06): Reiter und einklappbare Bereiche (#84), Ausgleichszahlungen in der Statistik (#78), Rechnen in Betragsfeldern (#88). Davor `v1.2.0` (Vermögen, Budget-Datei, Zurücksetzen), `v1.1.0` (Test-Suite) und `v1.0.0` (alle 14 Ausbauphasen, Issues #16–#25). Änderungen: `CHANGELOG.md`.
- **Ursprung:** drei Excel-Budgetplanungen von Kevin; übernommen wurden Kategorienkatalog, Sparquote-Logik, Plan vs. Ist,
  Konten mit Monatsendständen und Sparziele.

## Seiten

Eingabe · Monat · Statistik (mit Vermögensverlauf) · Budget · Konten & Sparziele · Ausgleich (nur WG/Partner) · Einstellungen.

- **Budget** hat Reiter: Monatsbudget (Bereiche eingeklappt, Summe im Kopf), Kategorien, Fixkosten, Datei (Export/Import).
- **Einstellungen** haben Reiter: Haushalt, Darstellung, Daten (Backup, Daten zurücksetzen), Konto.
- Siehe [[Entscheid - Reiter statt langer Seiten]].

## Weiter

[[Offene Punkte]] · [[Architektur-Überblick]] · [[Betrieb]]
