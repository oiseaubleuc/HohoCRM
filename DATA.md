# Waar zit de data? — Nebula

Overzicht van **alle** gegevenslagen in dit project en hoe ze samenhangen met jouw SaaS-plannen.

## 1. CRM-gegevens (klanten, facturen, …) — **nu primair lokaal**

| Locatie | Wat | Wanneer |
|--------|-----|--------|
| **Browser `localStorage`** | Sleutel **`mijncrm`**: volledige JSON-database (`klanten`, `projecten`, `facturen`, …) | Na **admin-login** (`admin` / lokaal ingesteld wachtwoord) |
| **Geheugen** | `window.__NEBULA_DB__` (zelfde object als `db` in `crm-app.js`) | Voor o.a. PDF-facturen in dezelfde tab |

- Data is **per browser / per toestel**. Geen automatische synchronisatie tussen Mac en iPhone tenzij je **export/import** gebruikt.
- **Backup:** instellingen → export (`nebula-export-*.json`), bewaar veilig (bevat bedrijfsgegevens).

## 2. Optionele cloud-kopie (Netlify)

Als de app op **Netlify** draait én cloud-sync aan staat:

| Locatie | Wat |
|--------|-----|
| **Netlify Blobs** | Store `crm-sync`: per gebruiker `admin` een blob `db/admin` met dezelfde JSON-structuur |
| **Netlify Blobs** | `users/admin` — gehasht wachtwoord (PBKDF2) voor sync-login |

Functies: o.a. `netlify/functions/crm-save.mjs`, `crm-load.mjs`, `crm-auth.mjs` (zie `_crm-sync.mjs`).

- Dit is **geen** volledige multi-tenant database: één sync-account, blob per username.
- Geschikt als **tussenstap** (backup + eenvoudige sync), niet als juridische “bron van waarheid” voor honderden tenants.

## 3. PostgreSQL (SaaS-backend) — **schema klaar, UI nog niet gekoppeld**

| Locatie | Wat |
|--------|-----|
| **`backend/sql/001_core.sql`** | Tabellen: `tenants`, `users`, `memberships`, `companies`, `projects`, `audit_logs`, … |
| **`DATABASE_URL`** | Verbinding vanaf `backend/src/server.mjs` |

- Vandaag levert de API o.a. **`GET /v1/tenants`** (met sleutel), nog **geen** automatische sync vanuit `localStorage`.
- **Doel voor echte SaaS:** CRM schrijft/leest per **tenant** via API → Postgres wordt de centrale waarheid (backups, RLS, compliance).

## 4. Platform- en release-data (door jou beheerd)

| Locatie | Wat |
|--------|-----|
| **`backend/data/platform-config.json`** | Feature flags, `releaseManifestPatch`, defaults, berichten — via **`PUT /v1/admin/platform-config`** |
| **`webapp/public/releases/nebula-release-manifest.json`** | Statische basis voor `.pkg` / `.dmg` URLs (wordt live **gemerged** met `releaseManifestPatch`) |

## 5. Build-artefacten (geen klantdata)

| Locatie | Wat |
|--------|-----|
| **`artifacts/`**, **`build/`**, **`webapp/dist/`** | Installers, gecompileerde webapp — **niet** voor CRM-records. |

---

## Praktisch: wat moet jij doen met “de data”?

1. **Nu (lokaal / klein team):** regelmatig **export JSON** + Time Machine / cloud-backup van belangrijke machines.
2. **Netlify-sync:** zorg dat Blob-store + secrets correct staan; begrijp dat het één gedeelde blob-structuur is.
3. **Richting volledige SaaS:** plan migratie **localStorage → API → Postgres** (per tenant), met auth (JWT) en eventueel import van bestaande `nebula-export-*.json`.

Als je wilt, kan de volgende implementatiestap zijn: **`POST /v1/tenants/:slug/snapshot`** die de export-JSON valideert en in Postgres wegschrijft — dat zou de brug zijn tussen huidige CRM en centrale data.
