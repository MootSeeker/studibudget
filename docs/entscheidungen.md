# Entscheidungen

## Abhängigkeiten

| Paket                                   | Wofür                                                           |
| --------------------------------------- | --------------------------------------------------------------- |
| react, react-dom, react-router          | Oberfläche, Hash-Routing (GitHub Pages hat keine SPA-Fallbacks) |
| tailwindcss                             | Gestaltung, Farben als CSS-Variablen für hell/dunkel            |
| dexie, dexie-react-hooks                | Lokale Datenbank (IndexedDB), Live-Abfragen                     |
| @supabase/supabase-js                   | Konto und Sync                                                  |
| supabase (dev)                          | CLI für Migrationen und lokales Supabase in Docker              |
| vitest, testing-library, fake-indexeddb | Tests                                                           |

Krypto läuft ausschliesslich über die eingebaute Web Crypto API, es gibt keine Krypto-Bibliothek.

## Verschlüsselung (Ende-zu-Ende)

- `master = PBKDF2-SHA256(Passwort, "studibudget:" + E-Mail, 600'000 Iterationen)`
- `authSecret = HKDF(master, "studibudget-auth")` geht als «Passwort» an Supabase Auth.
  Das echte Passwort verlässt das Gerät nie.
- `KEK = HKDF(master, "studibudget-enc")` verpackt den zufälligen Datenschlüssel (DEK, AES-GCM-256).
- Der Wiederherstellungsschlüssel (128 Bit Zufall, 26 Zeichen Base32) verpackt denselben DEK ein zweites Mal.
- Jeder Datensatz wird mit dem DEK verschlüsselt (AES-GCM, zufälliger IV, Datensatz-ID als AAD).

Der Server speichert nur: E-Mail, verpackte Schlüssel, Datensatz-ID, `hlc`, Löschkennzeichen, Chiffretext.

## Datenbank-Zugriff

- Row-Level-Security auf `user_keys` und `records`: jede Person sieht nur die eigenen Zeilen.
- `records` ist nur lesbar; Schreiben geht ausschliesslich über `push_records()`
  (Last-Writer-Wins pro Datensatz, max. 500 pro Aufruf, Chiffretext < 200 kB).
- `delete_account()` löscht Benutzer und alle Daten (Cascade).
- `npm run test:db` prüft das gegen ein lokales Supabase (Docker, `npx supabase start`).

## Konto-Abläufe

- **Registrierung:** Die verpackten Schlüssel reisen als Metadaten mit dem Signup. Ein Datenbank-Trigger
  übernimmt sie in `user_keys` und entfernt sie aus den Metadaten (auch bei späteren Updates). So geht nichts
  verloren, obwohl wegen der E-Mail-Bestätigung zunächst keine Sitzung entsteht.
- **Login:** Der Schlüssel-Ableitungsaufwand (`kdf`) ist in v1 fest (600'000 Iterationen), weil er vor dem
  Login noch nicht vom Server gelesen werden kann.
- **PKCE:** Links aus E-Mails kommen mit `?code=…` zurück und passen damit zum Hash-Routing. Der Link zum
  Passwort-Zurücksetzen muss im selben Browser geöffnet werden, in dem er angefordert wurde.
- **Passwort ändern:** Zuerst wird das Auth-Passwort gesetzt, dann der Datenschlüssel neu verpackt (3 Versuche).
  Bleibt der zweite Schritt trotzdem aus, rettet der Wiederherstellungsschlüssel.
- **Abmelden** löscht Sitzung, lokale Daten und lokalen Schlüssel.

## Sync

- **Offline-first:** Die App liest und schreibt nur lokal (Dexie). Geschrieben wird ausschliesslich über
  `src/data/store.ts`: Es stempelt jeden Datensatz mit der Uhr und merkt ihn in der Outbox vor.
- **Uhr (HLC):** `updatedAt` ist ein Zeitstempel `Wanduhr-Zähler-Gerät` fester Länge, also als Text sortierbar.
  Sie läuft nie rückwärts, auch wenn die Systemzeit springt, und nimmt fremde Stempel zur Kenntnis.
- **Konflikte:** Last-Writer-Wins pro Datensatz (grössere `updatedAt` gewinnt), clientseitig und im Server
  (`push_records`). Löschen ist ein Grabstein (`deleted: true`).
- **Ablauf:** Hochladen (Outbox, höchstens 500 pro Aufruf, wiederholbar ohne Schaden), dann Holen (`seq`
  grösser als der letzte Stand, seitenweise). Auslöser: Start, 2 s nach einer Änderung, wieder online,
  App wieder sichtbar, alle 60 s.
- **Fehlerverhalten:** Netzwerkfehler → «Offline», Änderungen bleiben vorgemerkt. Nicht entschlüsselbare
  Datensätze werden übersprungen und gezählt, der Rest wird übernommen.
- **Einstellungen** haben eine feste UUID, weil es pro Konto genau eine Zeile gibt und der Server UUIDs verlangt.

## Einrichtung und Einstellungen

- **Assistent:** erscheint erst nach dem ersten Abgleich mit dem Server. Wer sich auf einem neuen Gerät anmeldet,
  hat seine Einstellungen bereits im Konto und soll nicht ein zweites Mal einrichten. Ohne Verbindung gibt es
  deshalb «Nochmals versuchen» statt Assistent. Gespeichert wird erst am Ende; `settings` kommt zuletzt, erst dann
  gilt die Einrichtung als abgeschlossen.
- **Wechsel von Land, Wohnsituation oder Auto:** zeigt vorab, welche Standardkategorien hinzukommen, wieder
  eingeblendet, ausgeblendet oder umbenannt werden. Kategorien werden nie gelöscht, nur ausgeblendet; umbenannt
  wird nur, wenn der Name noch dem Standardnamen entspricht. Beträge werden beim Landeswechsel nicht umgerechnet.
- **Darstellung** liegt in den (synchronisierten) Einstellungen; der Browser merkt sich sie zusätzlich lokal,
  damit beim Laden nichts aufblitzt.

## Eingabe

- **Buchung bauen:** `src/domain/entry.ts` prüft die Formulareingaben und rechnet den Eigenanteil; die Seite
  zeigt nur an. Beträge werden als Cent gespeichert, `23,5` und `1'234.50` werden erkannt.
- **Teilen:** WG gleichmässig auf die gewählten Beteiligten (Rundungsrest geht auf), Partner/in mit Prozentanteil
  pro Buchung (Vorgabe aus den Einstellungen). Nur Ausgaben lassen sich teilen. «Bezahlt von» speist den Ausgleich.
- **Fixkosten-Vorlagen:** Entstehen über das Häkchen «Jeden Monat wiederholen». Pro Monat erscheint ein Hinweis
  mit Dialog (Betrag und Notiz änderbar, bei geteilten Kosten wird die Aufteilung mitgerechnet). Doppelbuchungen
  verhindert `templateId + templateMonth`, vor dem Buchen wird frisch gegen die Datenbank geprüft. Eine
  gelöschte Buchung macht die Vorlage für den Monat wieder offen. Die Verwaltung (Betrag, Monate, pausieren,
  löschen) liegt vorerst auf der Eingabe-Seite.
- **Anzeige:** Die Liste zeigt immer den Eigenanteil; bei geteilten Buchungen steht dahinter der Gesamtbetrag.

## Budget

- **Gültig ab Monat:** Ein Budget ist ein Eintrag «ab Monat X». Eine Änderung im selben Monat überschreibt den
  Eintrag, in einem späteren Monat legt sie einen neuen an; frühere Monate behalten ihren Wert (wichtig für
  «Plan vs. Ist» in der Statistik).
- **Summen** zählen nur sichtbare Kategorien. «Bleibt übrig» = Einnahmen − Ausgaben − Sparen (Plan).
- **Kategorien** werden nie gelöscht, nur ausgeblendet; Reihenfolge per ↑/↓ innerhalb des Bereichs, Wechsel
  des Bereichs hängt die Kategorie ans Ende des neuen Bereichs. Namen innerhalb eines Bereichs sind eindeutig.
- **Übertrag** (nur Ausgaben) startet im gewählten Monat; der Rest früherer Monate wird addiert, Überschreitungen
  abgezogen (siehe `rolloverCents`).
- **Fixkosten-Vorlagen** werden auf dieser Seite verwaltet (zuvor auf der Eingabe-Seite).

## Monatsseite

- **Ampel** nur für Ausgaben: Anteil von (Budget + Übertrag), grün unter der Gelb-Schwelle, gelb ab Gelb, rot ab Rot
  (Standard 80 % / 100 %). Der Status steht immer auch als Text («Im Rahmen», «Knapp», «Ausgeschöpft»,
  «Überschritten», «Ohne Budget»), nie nur als Farbe. Einnahmen und Sparen zeigen einen Fortschritt in Prozent.
- **Prognose** (nur laufender Monat): gebuchte Fixkosten + noch offene Vorlagen + übrige Ausgaben bisher, linear auf
  den ganzen Monat hochgerechnet. Zu Monatsbeginn ist sie ungenau (wenige Tage, einzelne grosse Käufe), die Seite
  weist darauf hin. Vergangene Monate zeigen das Ergebnis, künftige keine Prognose.
- **Vergleich:** Vormonat (leer = «keine Daten») und Durchschnitt der letzten 3 Monate, in denen es Buchungen gab.
- **Statusfarben** sind Tokens (`--ok`, `--warn`, `--bad`) mit eigenen Werten für hell und dunkel.
- Bearbeiten und Löschen bleiben auf der Eingabe-Seite; die Monatsseite ist eine reine Auswertung.
