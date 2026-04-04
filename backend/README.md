# Nebula API (fundament)

PostgreSQL-schema + minimale **Express**-server als startpunt voor multi-tenant SaaS. Dit vervangt **niet** automatisch de huidige `localStorage`-webapp; die blijft standalone tot de frontend op deze API wordt aangesloten.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Pas DATABASE_URL aan, maak database aan, voer schema uit:
# psql "$DATABASE_URL" -f sql/001_core.sql
npm start
```

Endpoints:

- `GET /health` — status
- `GET /v1/meta` — productmeta
- `GET /v1/releases/latest` — release-manifest (publiek; rate-limited); **+ live patch** uit `platform-config.json` (zie hieronder)
- `GET /v1/public/settings` — publieke feature flags / branding-defaults / berichten (geen secrets)
- `GET` / `PUT` `/v1/admin/platform-config` — **SaaS-beheer** (vereist `INTERNAL_API_KEY`): centrale JSON op schijf (`backend/data/platform-config.json`). `PUT` doet een *deep merge*; daarna worden releases direct hertrokken.
- `POST /v1/admin/platform-config/reload` — herlees config van schijf (na handmatige edit)
- `GET /v1/tenants` — lijst tenants (DB vereist; met sleutel: zie `INTERNAL_API_KEY`)
- `POST /v1/auth/register` | `/login` — **501 stub** (volgende fase)

Voorbeeld (lokaal, sleutel in `.env`):

```bash
curl -sS -H "Authorization: Bearer $INTERNAL_API_KEY" http://127.0.0.1:4000/v1/admin/platform-config
curl -sS -X PUT -H "Authorization: Bearer $INTERNAL_API_KEY" -H "Content-Type: application/json" \
  -d '{"releaseManifestPatch":{"version":"1.0.1","pkg":{"url":"https://cdn.example.com/Nebula.pkg"}}}' \
  http://127.0.0.1:4000/v1/admin/platform-config
```

Sjabloon: `platform-config.example.json`. Productie: zet `PLATFORM_DATA_DIR` op persistente volume.

## Security (kort)

- Standaard luistert de server op **`127.0.0.1`** — voor Docker/public: `LISTEN_HOST=0.0.0.0`.
- **Headers:** o.a. `nosniff`, `X-Frame-Options: DENY`, beperkte `Permissions-Policy`.
- **Rate limiting** op publieke routes (configureerbaar via `RATE_LIMIT_*` in `.env.example`).
- **Productie:** zet `CORS_ORIGIN` (frontend-URL) en `INTERNAL_API_KEY` als de database aan staat. Zie repo-root **`SECURITY.md`**.

## Schema

`sql/001_core.sql` bevat o.a. `tenants`, `users`, `memberships`, `companies`, `projects`, `audit_logs`. Breid uit met facturen, taken, AI-logs, billing-tabellen volgens productroadmap.

## Merk

**Nebula** by **HohohSolutions**.
