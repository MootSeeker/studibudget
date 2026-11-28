# StudiBudget lokal in Docker

Für Test, Demo oder Review ohne Node-Installation. Nicht für produktives Hosting (dafür GitHub Pages, siehe `README.md`).

Das Image baut die App mit Node und liefert sie mit nginx unter `/studibudget/` aus (wie auf GitHub Pages). Unbekannte Pfade fallen auf `index.html` zurück. Die Supabase-Werte werden **beim Bauen** eingesetzt (`VITE_*` gehört in den ausgelieferten Code), deshalb braucht jeder andere Wert ein neues Image.

## Mit dem lokalen Supabase

```bash
npx supabase start                 # braucht Docker
npx supabase status -o env         # API_URL und ANON_KEY ablesen
docker build -t studibudget \
  --build-arg VITE_SUPABASE_URL=<API_URL> \
  --build-arg VITE_SUPABASE_ANON_KEY=<ANON_KEY> .
docker run --rm -p 8080:8080 studibudget
```

Danach läuft die App unter <http://localhost:8080/studibudget/>. Konto anlegen, Anmelden und Sync gehen gegen das lokale Supabase; Bestätigungsmails landen im Mail-Fänger unter <http://127.0.0.1:54324>.

- `API_URL` muss vom Browser aus erreichbar sein (lokal `http://127.0.0.1:54321`), nicht vom Container aus: Die App spricht Supabase aus dem Browser an.
- Die Content-Security-Policy erlaubt nur die beim Bauen angegebene Supabase-Adresse.
- Die beiden Werte sind öffentlich (Projekt-URL und anon/publishable Key). Geheimnisse wie der `service_role`-Schlüssel gehören nie in ein `--build-arg`.
- `.env.local` und andere lokale Dateien kommen nicht ins Image (`.dockerignore`).

## Mit einem anderen Supabase-Projekt

Gleich, nur mit dessen Projekt-URL und Anon-Key. In den Auth-Einstellungen des Projekts muss `http://localhost:8080/studibudget/` als Redirect-URL erlaubt sein, sonst führen die Links in den Mails ins Leere.
