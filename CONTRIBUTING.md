# Mitmachen

Danke für dein Interesse an StudiBudget. Beiträge sind willkommen: Fehlerberichte, Ideen und Code.
Bitte beachte den [Verhaltenskodex](CODE_OF_CONDUCT.md). Das Projekt steht unter der [GPL-3.0](LICENSE); mit deinem Beitrag stimmst du zu, dass er unter dieser Lizenz steht.

## Fehler melden oder etwas vorschlagen

Lege ein [Issue](https://github.com/MootSeeker/studibudget/issues/new/choose) mit dem passenden Formular an (Fehler oder Anforderung).
Eine Anforderung braucht prüfbare Akzeptanzkriterien («AK-1: Wenn … dann …»). Schreibe **keine** echten Finanzdaten, Schlüssel oder Passwörter in Issues: das Repository ist öffentlich.
Sicherheitslücken meldest du nicht hier, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.

## Entwicklung einrichten

```bash
npm install
npx supabase start     # lokales Supabase (Docker); .env.local aus .env.example
npm run dev
```

Die Node-Version steht in `.nvmrc`. Weitere Skripte und das Testkonzept stehen in [README.md](README.md) und [docs/testing.md](docs/testing.md).

## Ablauf für Code

1. Arbeite an einem Issue und kommentiere dort kurz, dass du es übernimmst.
2. Neuer Branch pro Thema; nie direkt auf `main`.
3. Tests zuerst: jedes Akzeptanzkriterium bekommt einen Test.
4. Vor dem Push lokal `npm run verify` und `npm run test:slow`.
5. Pull Request mit der Vorlage ausfüllen, das Issue verknüpfen (`Closes #123`). Ein PR behandelt ein Thema.
6. Gemergt wird erst, wenn die CI komplett grün ist und eine verantwortliche Person zugestimmt hat.

## Leitplanken im Code

- Geld als ganze Rappen/Cent, Monate `YYYY-MM`, Datum `YYYY-MM-DD`.
- Rechenlogik als reine Funktionen in `src/domain/` mit Unit-Tests.
- Geschrieben wird nur über den `store`; Löschen ist ein Grabstein (`deleted: true`); neue Felder sind immer optional.
- Verschlüsselung in `src/crypto/`, Sync in `src/sync/`: der Server sieht nie Klartext.
- Texte auf Deutsch in Schweizer Schreibweise (kein ß).
- Keine Geheimnisse committen (`.env.local`, Schlüssel, Tokens).

Mehr zum Warum steht in [docs/entscheidungen.md](docs/entscheidungen.md).
