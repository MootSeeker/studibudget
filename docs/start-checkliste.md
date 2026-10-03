# Start-Checkliste

Solange diese Punkte offen sind, sollten sich keine fremden Personen registrieren. `npm run check:launch` prüft, was sich
automatisch prüfen lässt, und erinnert an den Rest.

## 1. Vor dem öffentlichen Start (Blocker)

- [ ] **Datenschutzerklärung und Impressum ausfüllen** (`src/legal/content.ts`; jede `TODO(human)`-Markierung entfernen).
      Die App schreibt diese Texte bewusst nicht für dich. Welche Angaben Pflicht sind, hängt vom Land und von der
      Betriebsform ab: lass dich beraten. Technische Fakten dafür stehen unten in Abschnitt 2.
- [ ] **Eigenen E-Mail-Versand einrichten** (Supabase › Authentication › SMTP). Der eingebaute Versand ist stark
      begrenzt (nur wenige Mails pro Stunde) und nur zum Ausprobieren gedacht. Ohne eigenen Versand scheitern Registrierung
      und «Passwort vergessen» bei mehr als ein paar Personen.
- [ ] **Adressen setzen** (Supabase › Authentication › URL Configuration): _Site URL_ und _Redirect URL_ =
      `https://mootseeker.github.io/studibudget/`.
- [ ] **Region und Auftragsverarbeitung prüfen**: Region des Projekts (Project Settings › General) und den
      Auftragsverarbeitungsvertrag (DPA) von Supabase. Die Region gehört in die Datenschutzerklärung.
- [ ] **Registrierung bewusst steuern**: Bis alles oben erledigt ist, «Allow new users to sign up» (Authentication ›
      Sign In / Providers) ausschalten. Die App zeigt dann «Die Registrierung ist im Moment geschlossen.» Danach einschalten.
- [ ] `npm run check:launch` ist grün.

## 2. Technische Fakten für die Datenschutzerklärung

Das sind Tatsachen über die App, keine Rechtstexte.

**Was der Server (Supabase) speichert**

- E-Mail-Adresse, Zeitpunkte von Registrierung und Anmeldung, technische Protokolle der Anmeldung (u. a. IP-Adressen,
  Aufbewahrung nach den Regeln von Supabase).
- Das Passwort selbst wird **nicht** übertragen, nur ein daraus abgeleiteter Wert.
- Pro Person die verpackten Schlüssel (nicht lesbar ohne Passwort bzw. Wiederherstellungsschlüssel).
- Pro Datensatz: ID, Änderungszeitpunkt (logische Uhr), Löschkennzeichen, **verschlüsselter** Inhalt. Beträge, Kategorien,
  Notizen, Namen von Mitbewohnern usw. sind Teil des verschlüsselten Inhalts.

**Was die Betreiberin / der Betreiber sehen kann**: Anzahl, Grösse und Änderungszeitpunkte der Datensätze; keine Inhalte.

**Hosting der App**: GitHub Pages (beim Abruf der Dateien fallen bei GitHub technische Daten wie die IP-Adresse an).

**Auf dem Gerät der Nutzenden**: IndexedDB (Daten, unverschlüsselt), `localStorage` (Anmeldesitzung, Darstellung),
Service-Worker-Cache (nur die App-Dateien). Keine Cookies, keine Tracker, keine Analyse, keine externen Schriften oder Skripte.

**Löschen**: «Konto löschen» entfernt das Konto und alle Datensätze auf dem Server (Cascade). Protokolle bei Supabase
unterliegen deren Aufbewahrung.

**Datenübertragbarkeit**: Einstellungen › Backup erzeugt eine JSON-Datei mit allen Daten (nicht verschlüsselt).

**E-Mail**: Bestätigungs- und Zurücksetzen-Mails gehen über den eingerichteten SMTP-Anbieter (nach Punkt 1 zu nennen).

## 3. Selbst auf echten Geräten testen

- [ ] **Offline-Start**: Veröffentlichte Seite in Chrome öffnen, kurz warten, Flugmodus an, Seite neu laden. Die
      Anmeldung bzw. die App muss erscheinen. _(Im Entwicklungsumfeld konnte der Service Worker nicht ausgeführt
      werden, dieser Test ist deshalb von Hand nötig.)_
- [ ] **Installieren**: Android/Chrome («App installieren»), iPhone/Safari («Zum Home-Bildschirm»).
- [ ] **Registrieren mit zweitem Gerät**: Konto anlegen, Mail bestätigen, auf einem zweiten Gerät anmelden, Daten
      abgleichen, offline eine Buchung erfassen und wieder online gehen.
- [ ] **Passwort vergessen** mit dem Wiederherstellungsschlüssel (im selben Browser öffnen, in dem der Link angefordert wurde).
- [ ] **Backup** herunterladen und in ein zweites Konto einspielen.

## 4. Betrieb

- Gratis-Projekte bei Supabase können nach längerer Inaktivität pausiert werden (aktuelle Bedingungen beim Anbieter
  prüfen). Die App läuft dann lokal weiter, gleicht aber nicht ab, bis das Projekt im Dashboard wieder gestartet ist.
- Datenbank-Änderungen immer als Migration in `supabase/migrations/` und mit `npx supabase db push` einspielen, nach
  einem Probelauf mit `--dry-run`.
- Neue Versionen der App erscheinen für Nutzende als Hinweis «Eine neue Version ist verfügbar».
