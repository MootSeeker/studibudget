---
typ: hub
bereich: betrieb
status: offen
aktualisiert: 2026-10-10
repo-quelle:
  - docs/start-checkliste.md
tags:
  - typ/hub
  - status/offen
---

# Offene Punkte

Offene GitHub-Issues (Stand 2026-10-10): #72 (CI-Artefakte aufs NAS), #153 (`verify:kurz` und Umlaute), #155 bis #158 (KI-Konnektor: umgesetzt im PR, Migration `inbox` noch einzuspielen, siehe unten), #190 (Dependabot für npm und GitHub Actions).
Offen ist ausserdem der **öffentliche Start**. Die vollständige Liste steht in `docs/start-checkliste.md`; hier der Stand:

## Ideen für später (Label «Future / Idee»)

- [ ] **KI-Konnektor (#145, Analyse erledigt und geschlossen; Umsetzung in #155 Vorschlagsformat, #156 Text einfügen, #157 verschlüsselter Posteingang, #158 MCP-Server):** Analyse erledigt, siehe [[Entscheid - KI-Konnektor über Vorschläge mit Bestätigung]]. Gewählt: Vorschläge mit Bestätigung in der App, zuerst als Text-Übergabe (Claude und ChatGPT, kein Server), danach verschlüsselter Posteingang mit lokalem MCP-Server (Verschlüsselung auf dem Gerät). Reihenfolge #155, #156, #157, #158; Stufe 2 braucht eine Migration (Rückfrage vor dem Einspielen).

## Pilot Agenten-Ablauf (#128)

Sitzung mit Sonnet starten, `/issue-bearbeiten <Nr>` mit 2–3 Issues der Grösse Mittel. Pro Issue festhalten (Tokens und Aufrufe stehen in jeder Rückmeldung eines Subagenten):

| Issue | Planer (Opus) | Umsetzer (Haiku) | Reviewer | Hauptsitzung | Nachbesserungen | Umsetzungsrunden | Nacharbeit nach PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #126 | 2 Aufrufe, 84 k + 94 k Tokens (24 + 8 Werkzeugaufrufe) | Trockenlauf 70 k + 62 k, Umsetzen 44 k (24 Aufrufe) | 2 Aufrufe: 43 k (NACHARBEIT, nur formal: AK-2/AK-3 damals offen, CHANGELOG-Begründung), danach BEREIT | nicht getrennt messbar (siehe unten) | 2 (Trockenlauf: Befehl für den Rot-Lauf fehlte; Reviewer-NACHARBEIT, vom Planer ohne Codeänderung beschieden) | 1 | 1 (nur formal) |
| #113 | 1 Aufruf, 120 k Tokens (29 Werkzeugaufrufe) | Trockenlauf 103 k, Umsetzen 93 k (43 Aufrufe) | 2 Aufrufe: 30 k (NACHARBEIT, nur fehlende Referenzbilder), danach BEREIT | nicht getrennt messbar (siehe unten) | 0 | 1 | 1 (nur formal) |
| #112 | 1 Aufruf, 130 k Tokens (32 Werkzeugaufrufe) | Trockenlauf 72 k, Umsetzen 79 k (27 Aufrufe) | 1 Aufruf, BEREIT im ersten Durchgang (Aufruf mit klarem Hinweis, was bewusst offen bleibt) | nicht getrennt messbar | 0 | 1 | 0 |

- Hauptsitzung: Die App liefert keine Tokens pro Issue, nur die Grösse des Kontexts. Am Ende der Sitzung (#126, #136, #137, #113 und drei Vault-PRs, alles in einem Kontext) waren es 211 k von 1 M Tokens, davon 141 k Nachrichten. Das ist die Kontextgrösse, nicht die abgerechnete Menge, und nicht auf ein Issue aufteilbar.
- Einschätzung zum `schreiber` (geschätzt, nicht gemessen): PR-Beschreibung, Journal und CHANGELOG sind je Issue wenige Absätze, vermutlich 1 k bis 3 k Tokens Ausgabe. Das ist klein gegen einen Planer- oder Umsetzer-Aufruf (40 k bis 120 k). Ein `schreiber` müsste den Kontext erst übergeben bekommen; der Gewinn wäre gering. Vorschlag: keinen `schreiber` einführen. Entscheid bei Kevin.
- Beobachtung: Beide Reviewer-Durchgänge gaben zuerst NACHARBEIT, nur weil Belege erst nach dem Draft-PR entstehen (Referenzbilder aus dem Workflow, Lauf mit Wiederholungen). Jeder zweite Durchgang kostete 30 k bis 43 k Tokens. Vorschlag: den Reviewer erst aufrufen, wenn solche Belege vorliegen, oder im Aufruf klar sagen, was bewusst noch aussteht und nicht als NACHARBEIT zählt.
- Beobachtung: Der Trockenlauf fand bei #126 eine echte Lücke (Rot-Lauf einer Playwright-Datei ohne lokales Supabase); bei #113 war er ohne Befund.
- Vergleich: ein ähnlich grosses Issue mit dem früheren Ablauf, sonst der Probelauf an #120 (PR #133).

## Sync

- [ ] Migration `20261010000000_inbox.sql` (#157) nach dem Merge auf dem echten Supabase-Projekt einspielen (erst `--dry-run`, Rückfrage bei Kevin). Ohne sie scheitern Verbindungen und Posteingang.
- [ ] KI-Konnektor von Hand ausprobieren: Text-Übergabe mit Claude und ChatGPT, MCP-Server in Claude Desktop (Schritte in `docs/ki-konnektor.md`); Ausgangsfrage: wird die Funktion genutzt?
- [x] Migration `20261009000000_push_records_lock.sql` (#48) am 2026-10-10 auf dem echten Supabase-Projekt eingespielt (`--dry-run` zeigte genau diese eine Migration; `migration list` zeigt sie lokal und remote).
- [x] Referenzbilder `einstellungen-konto-*` (geklärt am 2026-10-10): Sie weichen bei jedem Lauf des Workflows «Referenzbilder» ab, weil die Testadresse im Bild zufällige Ziffern enthält (feste Länge, siehe #126). Das ist erwartet, kein Fehler; der Bildtest toleriert die wenigen Pixel, belegt durch 120 grüne Wiederholungen. Beim Übernehmen neuer Bilder den Ordner nur für die betroffene Seite ersetzen.

## Blocker (Kevin)

- [ ] Datenschutzerklärung und Impressum ausfüllen (`src/legal/content.ts`, alle `TODO(human)` entfernen); danach `npm run check:launch`.
- [ ] Eigenen SMTP-Anbieter in Supabase einrichten (der Standardversand ist stark begrenzt).
- [ ] Region des Supabase-Projekts und Auftragsverarbeitungsvertrag (DPA) prüfen.
- [ ] «Allow new users to sign up» bewusst steuern, bis alles erledigt ist.

## Test-Suite (erledigt, `v1.1.0`)

- [x] Baustein 1 bis 13; Ausgangswert der Mutationstests 82,26 %, `break` = 80
- [ ] Mutationstests: überlebende Mutanten in `src/data/hooks.ts` (134, von keinem Unit-Test erfasst), `period.ts`, `monthView.ts`
- [ ] E2E-Test «Passwort vergessen» (WebKit, `e2e/auth.spec.ts`) ist instabil (Issue #116, ohne gefundene Ursache geschlossen, bei neuer Rötung neues Issue): in CI einmal rot (Überschrift nach dem Mail-Link fehlt), lokal in WebKit 2 von rund 190 Läufen rot, beide direkt nach der Browser-Installation und an anderer Stelle (nach dem Setzen des neuen Passworts). Mit mehr Last nicht herbeizuführen. Bei der nächsten Rötung Trace und Fehlermeldung (Link und Zielseite) sichern, bevor aufgeräumt wird.
- [ ] Vertrauliche Meldung von Schwachstellen einschalten (Kevin, Settings → Code security → Private vulnerability reporting): `SECURITY.md` verweist auf «Report a vulnerability», die Funktion ist aber aus (Prüfung der Repo-Einstellungen 2026-10-10).
- [ ] Dependabot-Warnungen und Sicherheits-Updates einschalten (Kevin), danach #190 umsetzen.
- [ ] Branch-Schutz (Kevin): `ci-gesamt` deckt nur den Workflow «Deploy» ab. Die Prüfungen aus «Doku» (format, links, vault, geheimnisse, claude-konfiguration) laufen bei Änderungen an Markdown und Doku-Pfaden, auch in gemischten PRs, und sind kein Teil von `ci-gesamt`. Doku-PRs lösen «Deploy» nicht aus, sodass `ci-gesamt` dort fehlt: für den Schutz braucht es einen zweiten Sammelstatus für «Doku» (und eine Antwort auf das Fehlen bei Doku-PRs), sonst blockiert er sie.
- [x] Bildtest «Konto» (#126, erledigt mit PR #135): Testadresse hat feste Länge, neue Referenzbilder, 120 grüne Wiederholungen im Workflow «Referenzbilder» (Eingabe `wiederholungen`).
- [ ] CI schneller machen (#62): Cache-Wirkung messen; falls `docker load` nicht schneller ist als der Download, Image-Cache entfernen

## Tests auf echten Geräten

- [ ] Rechnung (#105, #106, #121): Zahlteil drucken und den Swiss QR Code mit einer echten Banking-App scannen, mit **echter IBAN** (nicht der Beispiel-IBAN) und einem Umlaut in Name oder Ort; Layout des Zahlteils (Schriftgrössen, Kreuz) von Hand prüfen. Lehnt die App ihn weiter ab, die genaue Meldung festhalten und ein neues Issue anlegen (#121 ist geschlossen, AK-3 war nur teilweise belegt).
- [ ] Offline-Start und Installation (der Service Worker liess sich in der Entwicklungsumgebung nicht ausführen).
- [ ] Zweites Gerät: Sync, Offline-Buchung, Passwort vergessen mit Wiederherstellungsschlüssel, Backup einspielen.
- [ ] Konten und Sparziele von Hand ansehen (#112, #113): Kopfzeile mit Dropdown «Zeitraum», Pfeilen und Zeitraum-Zeile sowie den Verlauf-Chart mit mehreren Konten (Legende, Kästchen, dickere Gesamtlinie) bei 375, 768 und 1280 Pixel, hell und dunkel. Nur über Tests und eine Testseite mit Beispieldaten (Chart, 375 und 1280) abgesichert; die Seite selbst braucht eine Anmeldung und wurde nicht angesehen.
- [ ] Neues Layout (Issue #17) und die Reiter (#84) bei Handy-, Tablet- und Desktop-Breite ansehen: über Tests und Referenzbilder abgesichert, nicht von Hand geprüft.

Erledigte Issues: [[Issues]]
