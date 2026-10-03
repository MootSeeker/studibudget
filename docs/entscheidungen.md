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
