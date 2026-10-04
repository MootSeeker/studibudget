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

## Statistik und Diagramme

- **Diagramme ohne Bibliothek:** Die Diagramme sind handgeschriebenes SVG/HTML (`src/components/charts/`). Im Plan stand
  `recharts`; verzichtet wurde darauf, weil zwei einfache Diagramme die App-Grösse mehr als verdoppelt hätten, das Theming
  über CSS-Variablen (hell/dunkel) so direkt geht und eine Abhängigkeit weniger zu pflegen ist.
- **Regeln:** Balken höchstens 24 px mit 4 px runden Enden an der Datenseite, Linie 2 px, Punkte mit 2 px Ring in der
  Flächenfarbe, Gitter als dünne durchgezogene Linien. Eine Serie = eine Farbe, ab zwei Serien immer eine Legende.
- **Farben:** `--series-1` (Blau, Einnahmen) und `--series-2` (Orange, Ausgaben) in hell/dunkel; geprüft mit dem
  Palette-Validator (Abstand auch bei Farbfehlsichtigkeit bestanden). Der Saldo ist eine neutrale Linie in Textfarbe.
- **Nie nur Farbe/Tooltip:** Jeder Monat ist per Tastatur fokussierbar und hat ein vollständiges `aria-label`; jedes
  Diagramm hat eine Tabellenansicht; Abweichungen im Plan-Ist-Vergleich stehen mit Vorzeichen **und** Wort («drüber»,
  «darunter», «mehr», «weniger»).
- **Zeiträume:** Semester, Studienjahr, Kalenderhalbjahr, Kalenderjahr, letzte 6/12 Monate, frei (höchstens 36 Monate).
  Der Plan eines Zeitraums ist die Summe der Monatsbudgets (inkl. Budgetwechsel mittendrin); ausgeblendete Kategorien
  zählen nicht zum Plan.

## Konten und Sparziele

- **Leer heisst unbekannt, nicht 0** (wie in der Excel-Vorlage). Ein Stand von 0 ist eine Angabe; ein leeres Feld löscht sie.
  Das Gesamtvermögen eines Monats ist nur «vollständig», wenn alle einbezogenen Konten einen Stand haben; sonst zeigt die
  Tabelle die Teilsumme mit «unvollständig», und das Diagramm lässt den Monat als Lücke stehen, statt eine falsche Zahl zu
  behaupten. Für den Verlauf braucht es mindestens zwei vollständige Monate.
- **Schulden** (z. B. Kreditkarte) werden als geschuldeter Betrag eingegeben und negativ gespeichert; sie senken das
  Gesamtvermögen automatisch. Andere Konten dürfen negativ sein (überzogen).
- **Konten und Stände sind unabhängig von den Buchungen** (kein Abgleich «gerechnet gegen echt»): man trägt am Monatsende
  den echten Stand ein.
- **Sparziele:** Stand = Anfangsbestand + Einzahlungen − Entnahmen aus Spar-Buchungen mit diesem Ziel. Die nötige Rate
  rechnet vom aktuellen Monat bis einschliesslich Zielmonat. Ziele werden archiviert, nicht gelöscht; ein archiviertes
  Ziel blockiert seinen Namen nicht mehr.

## Eingabefelder mit Entwurf

Beträge werden in `DraftInput` bearbeitet: Das Feld behält den getippten Text, bis man es verlässt, auch wenn sich der
gespeicherte Wert zwischendurch ändert (Speichern kommt zurück, ein anderes Gerät synchronisiert). Zuvor wurde das Feld
über `key={…wert}` neu aufgebaut, wodurch getippter Text verloren ging. Der Entwurf gehört zu einem Feld und einem Monat
(`key` mit Monat auf der Budget-Seite), damit er nicht in einen anderen Monat mit gleichem Wert hinüberwandert.

## Ausgleich

- **Eine Quelle für die Wirkung:** `effectsOf(buchung)` berechnet, wie eine gemeinsame Buchung die Salden verschiebt; Saldo,
  Liste der gemeinsamen Buchungen und Vorschau benutzen dieselbe Funktion. Positiv = die Person schuldet mir, negativ = ich
  schulde ihr. Bezahlt jemand anderes für Personen ohne mich, ändert sich mein Saldo nicht.
- **Ausgleichszahlungen** («Ich habe Geld erhalten/bezahlt») verschieben nur den Saldo und zählen weder als Einnahme noch als
  Ausgabe, sind also nicht im Budget. «Ausgleichen» füllt das Formular mit der passenden Richtung und dem offenen Betrag vor,
  eine Vorschau zeigt den Saldo nach der Zahlung (auch bei Teil- oder Überzahlung). Löschen ist ein Grabstein, der Saldo
  stellt sich wieder her.
- **Inaktive Personen** erscheinen nur, solange noch etwas offen ist.
- **Namen von Personen sind eindeutig** (ohne Beachtung von Gross-/Kleinschreibung und Randleerzeichen), im Assistenten, beim
  Anlegen und beim Umbenennen. Sonst wäre der Ausgleich nicht mehr eindeutig lesbar.
- Bei «allein» oder «bei den Eltern» zeigt die Seite nur einen Hinweis; im Menü erscheint sie dort gar nicht.

## Backup

- **Datei:** JSON mit `app`, `schemaVersion`, `exportedAt` und allen nicht gelöschten Datensätzen je Tabelle, ohne
  Sync-Zeitstempel. Die Datei ist **nicht verschlüsselt** (die App sagt es an der Stelle, wo man sie herunterlädt).
- **Prüfung beim Einspielen** (`zod`, wird erst beim Einspielen nachgeladen): App-Kennung, Version (neuere wird abgelehnt),
  Typen und Wertebereiche jedes Feldes, IDs als UUID (der Server verlangt es), Anteile müssen den Betrag ergeben, alle
  Verweise zwischen Tabellen müssen aufgehen, Einstellungen müssen vorhanden und die Einrichtung abgeschlossen sein.
  Unbekannte Zusatzfelder werden verworfen.
- **Einspielen ersetzt alles** und läuft in **einer** Transaktion (ganz oder gar nichts). Was nicht im Backup steht, wird als
  gelöscht markiert und kommt so auch auf die anderen Geräte; alles Übernommene wird neu gestempelt und synchronisiert.
  Vorher zeigt die App den Inhalt (Anzahl je Art) und fragt nach.
- **Selbstprüfung beim Export:** Der Export prüft seine eigene Datei mit derselben Prüfung. Enthalten die eigenen Daten eine
  Unstimmigkeit, wird keine Datei erstellt, und die App nennt den Grund, statt ein Backup zu liefern, das sich im Ernstfall
  nicht einspielen lässt. (Gefunden an echten Testdaten.)
- **Erinnerung:** aus / 7 / 14 / 30 Tage; Hinweis oben, wenn noch nie gesichert wurde (und es Daten gibt) oder das letzte
  Backup zu alt ist; pro Sitzung wegklickbar.
- **Dauerhafter Speicher:** Nach der Einrichtung bittet die App den Browser um `navigator.storage.persist()`; verweigert er es,
  steht ein Hinweis im Backup-Bereich.

## App (PWA) und Sicherheit

- **Installierbar und offline:** `vite-plugin-pwa` erzeugt Manifest und Service Worker. Vorab geladen wird die App selbst
  (18 Dateien, ca. 0.8 MB); Antworten des Servers werden nie gecacht. Das Manifest hat `scope`/`start_url` `/studibudget/`
  und ein maskierbares Icon. Icons und Favicon erzeugt `scripts/make-icons.mjs` ohne zusätzliche Abhängigkeit.
- **Updates:** `registerType: 'prompt'`. Eine neue Version wird nur gemeldet («Jetzt aktualisieren»), nie heimlich aktiviert.
  Der Service Worker wird beim Start der App registriert, auch vor der Anmeldung.
- **Content-Security-Policy** als Meta-Tag (GitHub Pages erlaubt keine Kopfzeilen), nur im Build: `default-src 'self'`,
  keine Skripte ausser den eigenen Dateien, `connect-src` nur die eigene Seite und das Supabase-Projekt, kein `eval`.
  `style-src` braucht `'unsafe-inline'` wegen der Balkenbreiten (`style`-Attribute). `frame-ancestors` lässt sich per
  Meta-Tag nicht setzen; die App hat keine Anmeldung per Fremdseite, das Risiko ist gering.
- **Build-Prüfung** (`npm run check:build`, Teil von `verify`): Manifest, Icons, Service Worker, Vorabladung der App-Hülle
  und CSP (kein `unsafe-*` bei Skripten, keine Platzhalter, `connect-src` passt zum konfigurierten Server) werden am fertigen
  `dist/` geprüft.
- **Grösse:** Hauptpaket ca. 720 kB (gzip 208 kB); die Backup-Prüfung (`zod`) ist ausgelagert (gzip 26 kB).

## Abschluss: rechtliche Seiten, Handy, Bedienbarkeit

- **Datenschutz und Impressum sind ein Gerüst, kein Text.** `src/legal/content.ts` enthält die Abschnitte mit
  `TODO(human)`-Markierungen; solange eine offen ist, zeigt die Seite den Hinweis «Entwurf, rechtlich nicht gültig».
  Die Seiten sind auch vor der Anmeldung erreichbar (Link unter dem Anmeldeformular) und in der App im Menü.
  `npm run check:launch` schlägt fehl, bis alles ausgefüllt ist, und ist bewusst **nicht** Teil von `verify`.
  Technische Fakten als Grundlage stehen in `docs/start-checkliste.md`.
- **Registrierung geschlossen:** Meldet Supabase, dass Registrierungen ausgeschaltet sind, erscheint «Die Registrierung ist im
  Moment geschlossen.» statt einer technischen Meldung.
- **Handy:** Unter 768 px Breite gibt es einen Kopf mit Menü-Knopf (meldet `aria-expanded`, schliesst nach der Auswahl);
  Navigationspunkte sind mindestens 44 px hoch. Zeilen der Buchungsliste brechen um, damit Notizen lesbar bleiben.
  Geprüft bei 375 px: keine Seite scrollt seitlich, breite Tabellen scrollen in ihrem Bereich.
- **Tastatur:** Erster Tab-Halt ist «Zum Inhalt springen» (ein Knopf, kein `#`-Anker, weil die Adresse für das Routing
  gebraucht wird); überall ein sichtbarer Fokusrahmen; jeder Monat in den Diagrammen ist fokussierbar.
- **Seitentitel** folgen der Seite («Statistik – StudiBudget»).
- **Kontraste** werden bei jedem Testlauf aus den Farb-Tokens berechnet (`src/test/contrast.test.ts`): Text mindestens 4.5:1,
  Ränder von Eingabefeldern mindestens 3:1 (eigenes Token `--control`), in Hell und Dunkel.

## Zeitfehler vermeiden

Die Seiten lesen aus IndexedDB; auf einem langsamen Rechner kommen die Daten erst einen Moment nach dem ersten Anzeigen.
Zwei Arten von Fehlern ergeben sich daraus, beide wurden durch eine rote CI gefunden:

- **Tests, die zu früh lesen** (z. B. eine Auswahl treffen, bevor die Optionen geladen sind). Tests warten auf die Daten
  (`findBy…`, `waitFor`), nicht auf die Zeit.
- **Speichern auf einem veralteten Bildschirmzustand.** Änderungen laufen über `store.patch(tabelle, id, felder)`: Der
  aktuelle Datensatz wird innerhalb der Transaktion gelesen und nur die geänderten Felder werden angewendet, so überschreibt
  eine Änderung keine, die kurz davor gespeichert wurde. Die Budget-Seite sucht den vorhandenen Monatseintrag frisch in der
  Datenbank, damit zwei rasche Änderungen keinen zweiten Eintrag erzeugen.

`npm run test:slow` verzögert jeden Lesezugriff (150 ms) und lässt alle Tests laufen; er ist Teil der CI. `test.testTimeout`
beträgt 15 s, `asyncUtilTimeout` 4 s.

## Intervalle und Rückstellung (Issue #18)

- Das Intervall ist nur eine Eingabehilfe: Gespeichert werden weiterhin die Fälligkeitsmonate (`Template.months`). Alte Daten und Backups bleiben gültig.
- «Wiederholen» im Eingabeformular legt eine Vorlage mit dem gewählten Rhythmus ab dem Monat der Buchung an. Fällig wird sie über das bestehende Banner «Fixkosten buchen?».
- Die Rückstellung (Jahresbetrag ÷ 12 für alle Ausgaben-Vorlagen, die nicht jeden Monat fällig sind) ist nur ein Hinweis auf Monats- und Budgetseite. Saldo und Ampel bleiben unverändert. Pro Vorlage abschaltbar (`noReserve`). Bei geteilten Ausgaben zählt der Eigenanteil.

## Mehrere Autos (Issue #16)

- Es bleibt ein Bereich «Mobilität Auto». Das Auto wird pro Buchung gewählt (`Transaction.carId`) und pro Fixkosten-Vorlage festgelegt (`Template.carId`). Budget und Statistik bleiben pro Kategorie, nicht pro Auto.
- Autos sind eine eigene synchronisierte Tabelle `cars` (Name, archiviert, Reihenfolge). Verwaltet werden sie in den Einstellungen, sichtbar bei eingeschaltetem «Auto vorhanden».
- Die Auswahl erscheint bei allen Kategorien des Auto-Bereichs, auch bei selbst angelegten (`isCarCategory`). Mit genau einem aktiven Auto ist es vorgewählt. Archivierte Autos bleiben an alten Buchungen sichtbar.
- Backups ohne `cars` (ältere Versionen) bleiben importierbar.

## Responsives Layout (Issue #17)

- Der Rahmen hat keine feste Höchstbreite mehr. Die Seiten wachsen gestaffelt (`xl`, `2xl`), Formulare bleiben schmal.
- Die Seitenleiste lässt sich auf Laptop und grossen Bildschirmen einklappen; die Wahl steht in `localStorage` (ohne Speicher gilt sie bis zum Neuladen). Auf dem Handy bleibt das Menü hinter dem Knopf, Esc schliesst es.
- Eingabe ist ab `xl` zweispaltig (Formular links, Monatsliste rechts). Die Diagramme skalieren über ihr `viewBox`.
- Die Monatsspalte der Kontentabelle bleibt beim seitlichen Scrollen stehen; Monatspfeile sind mindestens 44 px gross.
