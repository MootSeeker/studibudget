# KI-Konnektor: Ausgaben per Claude oder ChatGPT erfassen

Eine KI (Claude oder ChatGPT) kann dir aus einem Kassenzettel, einer Liste oder einer Notiz einen Vorschlagsblock schreiben. Du fügst ihn in StudiBudget ein, prüfst jeden Eintrag und buchst erst dann. Der StudiBudget-Server ist daran nicht beteiligt.

**Datenschutz:** Was du der KI gibst, geht an deren Anbieter (Anthropic oder OpenAI). Diese Angaben schützt die Verschlüsselung von StudiBudget nicht. Gib der KI nur, was du ihr geben willst.

## Format

```json
{
  "studibudgetVorschlaege": 1,
  "eintraege": [
    {
      "id": "1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b",
      "date": "2026-10-09",
      "amountCents": 1850,
      "categoryName": "Einkauf zuhause",
      "note": "Migros"
    }
  ]
}
```

- `id`: eine neue, zufällige UUID pro Eintrag. Daran erkennt StudiBudget, ob ein Eintrag schon gebucht ist.
- `date`: Datum im Format JJJJ-MM-TT.
- `amountCents`: Betrag in Rappen oder Cent als ganze Zahl grösser 0 (CHF 18.50 = 1850).
- `categoryName`: Name einer Kategorie genau so, wie sie in StudiBudget heisst (Gross- und Kleinschreibung egal).
- `note`: Notiz, höchstens 200 Zeichen, darf leer sein.

## Auftrag an die KI

Diesen Text gibst du der KI, zusammen mit deinen Kategorien und dem Beleg:

> Erstelle für StudiBudget einen Vorschlagsblock. Antworte mit genau einem JSON-Objekt in einem Codeblock, ohne weiteren Text darin. Format: `{"studibudgetVorschlaege": 1, "eintraege": [ ... ]}`. Jeder Eintrag hat die Felder `id` (neue zufällige UUID), `date` (JJJJ-MM-TT), `amountCents` (ganze Zahl in Rappen, grösser 0), `categoryName` (genau einer dieser Namen: <deine Kategorien>) und `note` (kurze Notiz, höchstens 200 Zeichen). Erfinde keine Kategorien. Hier die Ausgaben: <Beleg oder Liste>

## Mit Claude

1. Öffne claude.ai und starte eine neue Unterhaltung.
2. Kopiere den Auftrag oben hinein. Ersetze `<deine Kategorien>` durch die Namen deiner Kategorien aus StudiBudget (Einstellungen, Kategorien) und `<Beleg oder Liste>` durch deine Ausgaben oder lade ein Foto des Belegs hoch.
3. Prüfe die Antwort und kopiere den JSON-Block (Knopf «Copy» am Codeblock).
4. Öffne in StudiBudget die Seite «Eingabe», klappe «KI-Vorschläge» auf und bestätige beim ersten Mal den Hinweis.
5. Füge den Block ins Feld «Vorschlagstext» ein und klicke «Vorschläge prüfen».
6. Ändere Einträge, wo nötig, und klicke pro Eintrag «Buchen» oder «Verwerfen».

## Mit ChatGPT

1. Öffne chatgpt.com und starte einen neuen Chat.
2. Kopiere den Auftrag oben hinein. Ersetze `<deine Kategorien>` durch die Namen deiner Kategorien aus StudiBudget (Einstellungen, Kategorien) und `<Beleg oder Liste>` durch deine Ausgaben oder lade ein Foto des Belegs hoch.
3. Prüfe die Antwort und kopiere den JSON-Block (Knopf «Code kopieren» am Codeblock).
4. Öffne in StudiBudget die Seite «Eingabe», klappe «KI-Vorschläge» auf und bestätige beim ersten Mal den Hinweis.
5. Füge den Block ins Feld «Vorschlagstext» ein und klicke «Vorschläge prüfen».
6. Ändere Einträge, wo nötig, und klicke pro Eintrag «Buchen» oder «Verwerfen».

## Was StudiBudget prüft

- Ungültige Einträge (falsches Datum, Betrag, unbekannte oder ausgeblendete Kategorie, zu lange Notiz) erscheinen unter «Nicht übernommen» mit Grund und werden nicht gebucht.
- Einträge, deren `id` schon gebucht war, erscheinen unter «Schon erfasst», auch wenn du die Buchung inzwischen gelöscht hast. Fügst du denselben Block zweimal ein, wird nichts doppelt gebucht.
