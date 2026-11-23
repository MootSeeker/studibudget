# StudiBudget lokal in Docker (#169): bauen mit Node, ausliefern mit nginx unter /studibudget/.
# Aufruf und Werte: docs/docker.md. Die VITE_*-Werte sind öffentlich (sie stehen ohnehin im ausgelieferten Code).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Ohne Zeilenfortsetzung, damit die Datei auch mit Windows-Zeilenenden funktioniert.
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY" || (echo "VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY als --build-arg angeben (docs/docker.md)" && exit 1)
RUN VITE_SUPABASE_URL="$VITE_SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" npm run build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/studibudget
EXPOSE 8080
