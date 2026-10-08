---
typ: hub
bereich: betrieb
status: offen
aktualisiert: 2026-10-08
repo-quelle:
  - docs/start-checkliste.md
tags:
  - typ/hub
  - status/offen
---

# Offene Punkte

Offene GitHub-Issues (Stand 2026-10-08): #48 (Analyse `records_seq`), #72 (CI-Artefakte aufs NAS), #121 (QR-Code von der Banking-App nicht akzeptiert; PR in Arbeit, Scan mit echter IBAN steht aus), #76 (Synchronisation von Informationen), #111 (CI-Sammelstatus, Zeitfehler-Wächter, Referenzbilder), #112 und #113 (Konten: Zeitdarstellung, Verlauf-Chart).
Offen ist ausserdem der **öffentliche Start**. Die vollständige Liste steht in `docs/start-checkliste.md`; hier der Stand:

## Blocker (Kevin)

- [ ] Datenschutzerklärung und Impressum ausfüllen (`src/legal/content.ts`, alle `TODO(human)` entfernen); danach `npm run check:launch`.
- [ ] Eigenen SMTP-Anbieter in Supabase einrichten (der Standardversand ist stark begrenzt).
- [ ] Region des Supabase-Projekts und Auftragsverarbeitungsvertrag (DPA) prüfen.
- [ ] «Allow new users to sign up» bewusst steuern, bis alles erledigt ist.

## Test-Suite (erledigt, `v1.1.0`)

- [x] Baustein 1 bis 13; Ausgangswert der Mutationstests 82,26 %, `break` = 80
- [ ] Mutationstests: überlebende Mutanten in `src/data/hooks.ts` (134, von keinem Unit-Test erfasst), `period.ts`, `monthView.ts`
- [ ] E2E-Test «Passwort vergessen» (WebKit, `e2e/auth.spec.ts`) ist instabil (Issue #116, ohne gefundene Ursache geschlossen, bei neuer Rötung neues Issue): in CI einmal rot (Überschrift nach dem Mail-Link fehlt), lokal in WebKit 2 von rund 190 Läufen rot, beide direkt nach der Browser-Installation und an anderer Stelle (nach dem Setzen des neuen Passworts). Mit mehr Last nicht herbeizuführen. Bei der nächsten Rötung Trace und Fehlermeldung (Link und Zielseite) sichern, bevor aufgeräumt wird.
- [ ] CI schneller machen (#62): Cache-Wirkung messen; falls `docker load` nicht schneller ist als der Download, Image-Cache entfernen

## Tests auf echten Geräten

- [ ] Rechnung (#105, #106): Zahlteil drucken und den Swiss QR Code mit einer echten Banking-App scannen; Layout des Zahlteils (Schriftgrössen, Kreuz) von Hand prüfen.
- [ ] Offline-Start und Installation (der Service Worker liess sich in der Entwicklungsumgebung nicht ausführen).
- [ ] Zweites Gerät: Sync, Offline-Buchung, Passwort vergessen mit Wiederherstellungsschlüssel, Backup einspielen.
- [ ] Neues Layout (Issue #17) und die Reiter (#84) bei Handy-, Tablet- und Desktop-Breite ansehen: über Tests und Referenzbilder abgesichert, nicht von Hand geprüft.

Erledigte Issues: [[Issues]]
