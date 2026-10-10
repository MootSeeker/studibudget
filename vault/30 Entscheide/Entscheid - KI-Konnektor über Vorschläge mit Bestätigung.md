---
typ: entscheid
bereich: sync
status: entschieden
datum: 2026-10-10
aktualisiert: 2026-10-10
repo-quelle:
  - src/crypto/keys.ts
  - src/crypto/records.ts
  - src/data/backup.ts
  - supabase/migrations/20261003000000_init.sql
tags:
  - typ/entscheid
  - status/entschieden
---

# KI-Konnektor liefert Vorschläge, die App verschlüsselt und bucht erst nach Bestätigung

**Status: entschieden** (Analyse zu #145)

## Frage

Ich möchte einer KI wie Claude oder ChatGPT sagen «gestern 18.50 für Mittagessen», und die Buchung soll in StudiBudget
landen. Der Schlüssel liegt aber nur beim Nutzer (siehe [[Verschlüsselung und Sync]] und
[[Entscheid - Offline-first und Ende-zu-Ende]]): Ein Konnektor kann nicht serverseitig in die Datenbank schreiben. Wie kommt
ein Eintrag der KI in die App, ohne dass der Server je Klartext sieht?

Unabhängig vom Weg gilt: Was ich der KI sage oder zeige, sieht deren Anbieter. Das lässt sich nicht verhindern, nur klar
kommunizieren.

## Optionen

| Option | Verhalten | Kosten |
| --- | --- | --- |
| A: Lokaler MCP-Server, direkt an die App | Ein Programm auf meinem Gerät nimmt Aufrufe von Claude Desktop entgegen und reicht sie über `http://127.0.0.1` an die offene App weiter | Die App muss offen sein; Browser blockieren oder fragen bei Zugriffen von einer HTTPS-Seite auf `localhost` (Private Network Access), auf dem Handy geht es gar nicht; ChatGPT kann keinen lokalen MCP-Server nutzen |
| B1: Posteingang über eine Server-Funktion | Die KI (Custom GPT mit Action, Claude-Connector) schickt Klartext an eine Supabase Edge Function, die ihn mit einem öffentlichen Schlüssel verschlüsselt und ablegt | Geht für Claude und ChatGPT, auch bei geschlossener App. Aber der Klartext läuft durch unseren Server: **bricht die Ende-zu-Ende-Zusage**, verworfen |
| B2: Posteingang, verschlüsselt auf dem Gerät | Ein lokaler MCP-Server verschlüsselt den Eintrag mit dem öffentlichen Posteingangs-Schlüssel und legt nur Chiffretext in eine Server-Tabelle `inbox`; die App entschlüsselt und zeigt ihn als Vorschlag | Neue Tabelle und Migration, Schlüsselpaar und widerrufbare Verbindungen; nur für MCP-fähige Programme auf dem Computer (Claude Desktop), nicht für ChatGPT im Browser |
| C: Import-Datei im Backup-Format | Die KI erzeugt JSON nach `src/data/backup.ts`, ich importiere es | `applyBackup` ersetzt **alle** Daten und löscht, was nicht in der Datei steht; für einzelne Buchungen gefährlich und ungeeignet, verworfen |
| D: Text-Übergabe mit eigenem Vorschlagsformat | Die KI antwortet mit einem kurzen JSON-Block (eigenes, kleines Format, nur neue Buchungen); ich kopiere ihn in die App, die App prüft ihn und zeigt die Einträge als Vorschläge | Ein Kopieren und Einfügen pro Gespräch; dafür kein Server, keine Migration, geht mit jeder KI und auf jedem Gerät |

## Was der Code heute tut

- Schlüssel: Aus Passwort und E-Mail entsteht per PBKDF2 ein Masterschlüssel; ein zufälliger Datenschlüssel (AES-GCM) ist
  zweimal verpackt, mit dem Passwort und mit dem Wiederherstellungsschlüssel (`src/crypto/keys.ts`). Es gibt nur
  symmetrische Schlüssel; wer etwas für mich verschlüsseln will, braucht heute den Datenschlüssel selbst.
- Datensätze: AES-GCM mit der Datensatz-ID als zusätzlich authentifizierte Daten (`src/crypto/records.ts`). Der Server
  speichert in `records` nur Chiffretext und kennt keine Tabellennamen der App.
- Backup: `applyBackup` ersetzt den ganzen Bestand in einem Schritt. Einen Import, der nur ergänzt, gibt es nicht.
- Buchungen haben Datum, Kategorie, Betrag in Rappen und Notiz, aber **kein Konto**. Ob Ein- oder Ausgabe, folgt aus der
  Kategorie. Das Vorschlagsformat kennt deshalb kein Konto; «unbekanntes Konto» aus #145 entfällt.

## Entscheid

Zweistufig, mit einem gemeinsamen Kern:

1. **Kern:** ein eigenes Vorschlagsformat (Version 1) und eine reine Prüffunktion in `src/domain/`. Ein Vorschlag hat
   `id` (UUID, von der KI erzeugt), `date` (`YYYY-MM-DD`), `amountCents` (ganze Rappen/Cent, grösser 0), `categoryName`
   (Name einer vorhandenen, nicht ausgeblendeten Kategorie) und `note` (höchstens 200 Zeichen). Die App zeigt jeden
   gültigen Vorschlag zur Bestätigung; ich kann ihn ändern oder verwerfen. Gebucht wird erst nach Bestätigung, über `store`,
   mit der `id` des Vorschlags als ID der Buchung. Kommt dieselbe `id` noch einmal, ist sie schon gebucht und wird
   übersprungen (doppelte Anfragen buchen nur einmal).
2. **Stufe 1: Text-Übergabe (Option D)**, für Claude und ChatGPT gleich. Kein Server beteiligt.
3. **Stufe 2: verschlüsselter Posteingang mit lokalem MCP-Server (Option B2)**, für Claude Desktop und andere MCP-Programme,
   auch wenn die App geschlossen ist. Die Vorschläge landen in derselben Bestätigungsliste wie in Stufe 1.

Verworfen: A (App muss offen sein, Browser-Hürden), B1 (Klartext auf dem Server), C (Import überschreibt alles).

## Wie die Ende-zu-Ende-Verschlüsselung gewahrt bleibt

- **Stufe 1:** Der Vorschlag geht von der KI über die Zwischenablage direkt in die App. Unser Server sieht ihn nie. Nach der
  Bestätigung ist er eine normale Buchung und wird wie jede andere mit dem Datenschlüssel verschlüsselt synchronisiert.
- **Stufe 2:** Die App erzeugt ein Schlüsselpaar für den Posteingang (ECDH P-256 mit der Web Crypto API, wie bisher ohne
  Krypto-Bibliothek). Der private Schlüssel wird mit dem Datenschlüssel verpackt und als verschlüsselter Datensatz
  synchronisiert; damit ist er über Passwort und Wiederherstellungsschlüssel genauso geschützt und wiederherstellbar wie
  alle Daten. Der öffentliche Schlüssel geht an den lokalen MCP-Server. Dieser verschlüsselt jeden Vorschlag **auf meinem
  Gerät** (ephemeres ECDH, HKDF, AES-GCM, Vorschlags-ID als zusätzlich authentifizierte Daten) und legt nur den
  Chiffretext in die Tabelle `inbox`. Der Server sieht Verbindungs-ID, Zeitpunkt und Grösse, aber keinen Betrag, keine
  Kategorie und keine Notiz. Der öffentliche Schlüssel kann nur verschlüsseln, nicht lesen: Wer ihn hat, kann höchstens
  Vorschläge einliefern, die ich ablehne. Die Verbindung darf nur in `inbox` einfügen (eigenes Token, kein Lesen, kein
  Zugriff auf `records`) und ist in den Einstellungen widerrufbar.
- **Grenze:** Was ich der KI sage, sieht deren Anbieter. Die App weist vor dem Einschalten darauf hin.

## Begründung

- Nur D und B2 halten die Zusage «der Server sieht nie Klartext» ein. B1 wäre bequemer für ChatGPT, bricht aber genau das
  Versprechen, für das die App ein Konto mit Ende-zu-Ende-Verschlüsselung hat.
- D ist klein, braucht keine Migration und funktioniert sofort mit beiden KIs; damit lässt sich prüfen, ob die Funktion
  überhaupt genutzt wird, bevor Server-Arbeit anfällt.
- Bestätigung in der App ist in beiden Stufen Pflicht: Die KI kann sich verhören oder eine falsche Kategorie wählen, und
  ein eingelieferter Vorschlag darf nie ungefragt Geld verbuchen.
- Der gemeinsame Kern (Format, Prüfung, Bestätigungsliste) macht Stufe 2 zu einem zweiten Zugang, nicht zu einer zweiten
  Funktion.

## Folgen

- Stufe 1 bleibt auf dem Gerät: keine Migration, kein neues Feld in Buchungen.
- Stufe 2 bringt eine neue Server-Tabelle `inbox` mit eigener RLS und Verbindungs-Tokens (Migration, vor dem Einspielen
  Rückfrage bei Kevin), einen neuen synchronisierten Datensatz für das Posteingangs-Schlüsselpaar (neue App-Tabelle, ohne
  Migration für `records`) und ein kleines Programm für den lokalen MCP-Server, das gepflegt werden muss.
- ChatGPT bleibt bei der Text-Übergabe, solange es keinen MCP-Weg gibt, der auf dem Gerät verschlüsselt.
- Lesender Zugriff der KI auf Budget und Stände bleibt ausgeschlossen (eigene Datenschutzfrage).
- Umsetzung in vier Folge-Issues zu #145: Vorschlagsformat und Prüfung, Text-Übergabe mit Bestätigung, Posteingang mit
  Schlüsselpaar und Verbindungen, lokaler MCP-Server.

Verwandt: [[Verschlüsselung und Sync]], [[Entscheid - Offline-first und Ende-zu-Ende]]
