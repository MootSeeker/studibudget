# StudiBudget

Eine einfache Budgetplanung für Studierende in der Schweiz und in Deutschland: Einnahmen, Ausgaben und Sparen nach
Kategorien erfassen, den aktuellen Monat im Blick behalten und Semester oder Jahr auswerten. Läuft im Browser, lässt sich
als App installieren und funktioniert auch ohne Internet.

> **Stand:** Alle geplanten Seiten sind gebaut. Vor der öffentlichen Freigabe fehlen noch Datenschutzerklärung und
> Impressum (siehe [docs/start-checkliste.md](docs/start-checkliste.md)).

## So nutzt du es

1. **Konto anlegen.** E-Mail und ein Passwort mit mindestens 12 Zeichen. Bestätige danach deine E-Mail-Adresse.
2. **Wiederherstellungsschlüssel sichern.** Er wird nur einmal angezeigt. Ohne ihn und ohne dein Passwort sind deine Daten
   nicht mehr lesbar, niemand kann sie für dich wiederherstellen (auch nicht der Betreiber).
3. **Einrichten.** Land, Wohnsituation (allein, WG, mit Partner/in, bei den Eltern), Semester und optional Monatsbudgets.
4. **Eingabe.** Jede Ausgabe, Einnahme oder Sparbuchung mit Betrag, Kategorie und Datum erfassen. Fixkosten wie Miete
   legst du einmal als Vorlage an und buchst sie jeden Monat mit einem Klick.
5. **Monat.** Zeigt pro Kategorie, wie viel Budget noch übrig ist (Ampel), eine Prognose bis Monatsende und den
   Vergleich mit den Vormonaten.
6. **Statistik.** Semester, Jahr oder frei gewählte Zeiträume: Wohin geht das Geld, Verlauf pro Monat, Plan gegen Ist.
7. **Budget.** Vier Reiter: «Monatsbudget» (Beträge pro Kategorie, Bereiche einklappbar mit Summe im Kopf), «Kategorien»
   (umbenennen, verschieben, ausblenden, neue anlegen), «Fixkosten» (Vorlagen) und «Datei» (Export und Import). Eine
   Änderung gilt ab dem gewählten Monat.
8. **Konten & Sparziele.** Kontostände am Monatsende, Vermögensverlauf und Sparziele mit Fortschritt.
9. **Ausgleich** (WG und Partner/in). Gemeinsame Ausgaben teilen, sehen wer wem wie viel schuldet, Zahlungen erfassen.
10. **Backup.** Unter Einstellungen › Daten kannst du alle Daten als Datei sichern und wieder einspielen. Die Einstellungen sind in
    Reiter gegliedert: Haushalt, Darstellung, Daten und Konto.
11. **Neu anfangen.** Unter Einstellungen › Daten › «Daten zurücksetzen» löschst du wahlweise Budget, Buchungen, Vorlagen,
    Ausgleichszahlungen, Konten oder Sparziele. Konto, Kategorien und Einstellungen bleiben. Das Budget allein
    kannst du auf der Budget-Seite exportieren und importieren.

**Auf mehreren Geräten:** Melde dich überall mit demselben Konto an, die Daten werden abgeglichen. **Ohne Internet:**
Eingaben werden gespeichert und abgeglichen, sobald du wieder online bist. **Installieren:** Einstellungen › «Als App
installieren» (auf dem iPhone: Safari › Teilen › Zum Home-Bildschirm).

## Deine Daten

- Deine Budgetdaten werden **auf deinem Gerät verschlüsselt, bevor sie hochgeladen werden** (Ende-zu-Ende). Der Server
  speichert nur unlesbare Daten. Er kennt deine E-Mail-Adresse, Anmeldezeitpunkte und wie viele Datensätze du hast und
  wann sie sich geändert haben, aber keine Beträge, Kategorien, Notizen oder Namen.
- Dein Passwort verlässt dein Gerät nie; der Server bekommt nur einen davon abgeleiteten Wert.
- Auf deinem Gerät liegen die Daten **unverschlüsselt** im Browser (damit die App offline funktioniert). Wer dein
  entsperrtes Gerät benutzt, sieht sie. «Abmelden» löscht die lokale Kopie.
- Die **Backup-Datei ist nicht verschlüsselt.** Bewahre sie sicher auf.
- Keine Werbung, keine Tracker, keine Analyse-Dienste, keine externen Schriften.
- «Konto löschen» (Einstellungen) entfernt dein Konto und alle Daten auf dem Server.

## Für Entwicklung

React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), Supabase (Anmeldung und verschlüsselter Speicher), Vitest, Playwright.

**Node:** Version 24 (steht in `.nvmrc`, daraus nimmt auch die CI ihre Version). Mindestens 24.15, sonst warnen mehrere Abhängigkeiten, und mit Node 24.13 scheitern drei Tests an der Schreibweise des Tausenderapostrophs.

```bash
npm install
npx supabase start        # lokales Supabase in Docker (braucht Docker)
cp .env.example .env.local  # dann API_URL und ANON_KEY aus `npx supabase status -o env` eintragen
npm run dev
```

| Befehl                  | Zweck                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`        | Lint, Typen, Tests mit Coverage, Build und Build-Prüfung (Definition von «fertig»)                                  |
| `npm run verify:kurz`   | `verify` und `test:slow` mit knappem Bericht (höchstens 30 Zeilen), plus Leitplanken und Abgleich mit dem Plan      |
| `npm test`              | Unit-Tests (Vitest)                                                                                                 |
| `npm run test:slow`     | Alle Tests mit künstlich verlangsamter Datenbank: findet Zeitfehler, die sonst nur auf langsamen Rechnern auftreten |
| `npm run test:prop`     | Eigenschaftsbasierte Tests (fast-check)                                                                             |
| `npm run test:db`       | Tests gegen das lokale Supabase (Zugriffsregeln, Konto, Sync), braucht Docker                                       |
| `npm run test:e2e`      | Ende-zu-Ende-, Barrierefreiheits- und Bildvergleichstests (Playwright), braucht Docker                              |
| `npm run test:mutation` | Mutationstests (Stryker), dauert rund 3 Stunden                                                                     |
| `npm run check:launch`  | Ist die App bereit für die öffentliche Freigabe?                                                                    |
| `npx supabase db push`  | Datenbank-Struktur auf das verknüpfte Projekt spielen                                                               |

Details zu den Testebenen, Berichten und Referenzbildern stehen in [docs/testing.md](docs/testing.md); die Änderungen
pro Version in [CHANGELOG.md](CHANGELOG.md).

Mails (Bestätigung, Passwort zurücksetzen) landen lokal im Mail-Fänger unter http://127.0.0.1:54324.

**Aufbau:** Rechenlogik ohne Oberfläche in `src/domain/`, Datenbank und Sync in `src/data/` und `src/sync/`,
Verschlüsselung in `src/crypto/`, Seiten in `src/pages/`. Entscheidungen und Begründungen stehen in
[docs/entscheidungen.md](docs/entscheidungen.md).

**Veröffentlichung:** Jeder Push auf `main` baut und veröffentlicht die App auf GitHub Pages (`.github/workflows/deploy.yml`).
Supabase-Adresse und öffentlicher Schlüssel kommen als GitHub-Actions-Variablen `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY`.

**Projekt-Wissen:** Der Ordner [vault/](vault/Start.md) ist ein Obsidian-Vault mit Entscheiden, Betriebswissen und dem
Verlauf. Er ist öffentlich: keine Geheimnisse hineinschreiben.

## Lizenz

GPL-3.0-or-later, siehe [LICENSE](LICENSE).
