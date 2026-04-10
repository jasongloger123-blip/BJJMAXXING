# BJJMAXXING Release auf Vercel

Diese Checkliste ist fuer den ersten echten Release mit eigener Domain gedacht.

## 1. GitHub vorbereiten

1. Repository auf GitHub erstellen
2. Lokales Projekt mit GitHub verbinden
3. Falls noch nicht geschehen:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <github-repo-url>
git push -u origin main
```

## 2. Vercel-Projekt anlegen

1. In Vercel mit GitHub anmelden
2. Repository importieren
3. Framework automatisch als Next.js erkennen lassen
4. Production Branch auf `main` lassen

## 3. Produktions-Umgebungsvariablen in Vercel setzen

Pflichtvariablen:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_GUARD_PACK`
- `STRIPE_PRICE_MEMBERSHIP`
- `STRIPE_PRICE_PREMIUM_REVIEW`
- `NEXT_PUBLIC_APP_URL`

Optional:

- `GOOGLE_MAPS_API_KEY`

Wichtig:

- `NEXT_PUBLIC_APP_URL` muss auf die echte Live-Domain zeigen
- Beispiel:
  - `https://bjjmaxxing.com`
  - oder `https://www.bjjmaxxing.com`

## 4. Domain mit Vercel verbinden

1. In Vercel die Domain hinzufuegen
2. DNS beim Domain-Provider auf Vercel umstellen
3. Warten, bis SSL aktiv ist
4. Eine kanonische URL festlegen:
   - entweder Root-Domain
   - oder `www`
5. Die jeweils andere Version auf die kanonische Domain weiterleiten

## 5. Supabase fuer Produktion anpassen

In Supabase Auth:

- `Site URL` auf die Produktions-Domain setzen
- Redirect URLs fuer Produktion hinterlegen

Empfohlene Redirects:

- `https://<deine-domain>/auth/callback`
- optional dieselbe URL mit `www`, falls du sie vor der Weiterleitung noch brauchst

Vor dem Livegang:

- sicherstellen, dass produktive Migrationen angewendet wurden
- Login/Register auf echter Domain testen

## 6. Stripe fuer Produktion anpassen

1. Produktive Price IDs in Vercel setzen
2. In Stripe einen produktiven Webhook anlegen:

```text
https://<deine-domain>/api/stripe/webhook
```

3. Den erzeugten Secret in `STRIPE_WEBHOOK_SECRET` eintragen
4. Checkout testen:
   - erfolgreich
   - abgebrochen
   - Webhook verarbeitet

## 7. Release-Test vor Livegang

- Domain laedt mit HTTPS
- Login/Register funktionieren
- Supabase Session bleibt erhalten
- Protected Routes leiten sauber um
- Stripe Checkout funktioniert
- Stripe Webhook funktioniert
- Uploads und Bilder funktionieren
- Admin-Bereiche funktionieren
- Ein kompletter Flow funktioniert:
  - Landing -> Login/Register -> App -> Payment -> Profil

## 8. CI/CD im Zielzustand

Minimal und ausreichend fuer v1:

- GitHub ist Source of Truth
- Vercel deployt automatisch
- Push auf `main` = Production Deploy
- Pull Requests = Preview Deploys

Im Repo vorhanden:

- `.github/workflows/ci.yml`
- `npm run typecheck`
- `npm run ci`

Das reicht fuer den Start. Eine eigene VPS-Pipeline ist nicht noetig.
