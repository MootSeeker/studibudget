# StudiBudget

Einfache Budgetplanung für Studierende in der Schweiz und in Deutschland: Einnahmen, Ausgaben
und Sparen nach Kategorien erfassen, den aktuellen Monat im Blick behalten und Semester oder
Jahr auswerten.

**Stand:** im Aufbau (Phase 1: Gerüst). Konto, Verschlüsselung und Sync folgen.

## Entwicklung

Die App braucht ein Supabase-Projekt. Lokal: `npx supabase start` (Docker), dann aus
`npx supabase status -o env` die Werte `API_URL` und `ANON_KEY` als `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY` in `.env.local` eintragen (Vorlage: `.env.example`). Bestätigungs-Mails
landet lokal im Mail-Fänger unter http://127.0.0.1:54324.

```bash
npm install
npm run dev      # Entwicklungsserver
npm run verify   # Lint, Typen, Tests, Build
```

## Lizenz

GPL-3.0-or-later, siehe [LICENSE](LICENSE).

## Datenbank-Tests (lokales Supabase)

Braucht Docker.

```bash
npx supabase start
npm run test:db
npx supabase stop
```
