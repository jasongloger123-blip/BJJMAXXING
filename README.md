# BJJMAXXING

BJJMAXXING ist eine Next.js-14-App fuer Brazilian Jiu-Jitsu mit Archetypen-Test, Skill-Tree, Review-Workflow, Trainings-Queue sowie Supabase- und Stripe-Integration.

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Stripe

## Projektstruktur

```text
app/
  (app)/                Geschuetzte Produktbereiche
  api/                  Server-Routen fuer Auth, Reviews, Stripe, Progress
  auth/                 Auth-Callback
  login|register|...    Oeffentliche Screens
components/             Wiederverwendbare UI-Bausteine
lib/                    Fachlogik, Konfigurationen und Datenhelfer
lib/supabase/           Client-, Server- und Admin-Zugriff auf Supabase
supabase/migrations/    Datenbank-Migrationen
```

## Architektur

- `app/` trennt oeffentliche Seiten, eingeloggte Produktbereiche und API-Endpunkte.
- `components/` enthaelt UI-Komponenten ohne Deploy- oder Datenbankverantwortung.
- `lib/` buendelt Domain-Helfer wie Nodes, Archetypen, Stripe und Start-Queue.
- `lib/supabase/` kapselt den Zugriff auf Supabase je nach Laufzeitkontext.
- `supabase/migrations/` versioniert Datenbankschema und Policy-Aenderungen.

Diese Aufteilung ist fuer GitHub sinnvoll, weil Produktlogik, UI und Infrastruktur sauber getrennt bleiben und neue Features leicht in derselben Struktur erweiterbar sind.

## Lokales Setup

1. Abhaengigkeiten installieren: `npm install`
2. Umgebungsvariablen aus `.env.example` in `.env` uebernehmen
3. Dev-Server starten: `npm run dev`

## Wichtige Umgebungsvariablen

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_GUARD_PACK`
- `STRIPE_PRICE_MEMBERSHIP`
- `STRIPE_PRICE_PREMIUM_REVIEW`
- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_MAPS_API_KEY`

## Release auf Vercel

Empfohlener Produktionsweg fuer dieses Projekt:

- GitHub als Source of Truth
- Vercel fuer Hosting und Deployments
- Supabase fuer Auth, DB und Storage
- Stripe fuer Checkout und Webhooks

Empfohlener Minimal-Workflow:

1. Repository auf GitHub pushen
2. Projekt in Vercel importieren
3. Produktions-Env-Variablen in Vercel setzen
4. Domain mit Vercel verbinden
5. Supabase Auth Redirects auf Produktions-Domain setzen
6. Stripe Webhook auf `/api/stripe/webhook` anlegen
7. Push auf `main` als Production-Deploy nutzen

Detaillierte Schritt-fuer-Schritt-Anleitung:

- [Vercel Release Guide](docs/vercel-release.md)

Verfuegbare Checks:

```bash
npm run typecheck
npm run build
npm run ci
```

## GitHub-Ready

Die Repository-Basis ist jetzt darauf ausgelegt, nur den eigentlichen Quellcode, Konfigurationen und Supabase-Migrationen zu versionieren. Lokale Secrets, Build-Artefakte und installierte Pakete bleiben draussen.

## Naechste Schritte fuer GitHub

Sobald `git` lokal verfuegbar ist und ein GitHub-Repository existiert, reichen diese Schritte:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <github-repo-url>
git push -u origin main
```
