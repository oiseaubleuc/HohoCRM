# Nebula — by HohohSolutions

Monorepo voor **Nebula**: premium operations-platform (CRM, projecten, finance, agenda, AI-ready roadmap). Dit pakket bevat de **webapp** (Vite), **macOS native wrapper** (Swift + WKWebView), **marketing/vitrine**, **Netlify functions**, en een begin **backend/SaaS-fundament** (`backend/`).

**Waar staat welke data?** (localStorage, Netlify Blobs, Postgres, platform-config) — zie **`DATA.md`**.

## Snel starten (webapp)

```bash
cd webapp
npm install
npm run dev
```

Open de dev-server-URL; productnaam in de UI: **Nebula** · **by HohohSolutions**.

## macOS-app bouwen

```bash
./scripts/build-native-mac-app.sh
```

Levert onder andere `artifacts/Nebula Native.app` en `artifacts/Te-testen/Nebula.app`.

## Installer (.pkg / .dmg)

```bash
./scripts/build.sh        # .pkg
./scripts/build.sh dmg    # .dmg
```

Output o.a. `artifacts/Nebula-v1.0.0.pkg` — installeert **`/Applications/Nebula.app`**. Oude installaties (`HOHOSOLUTIONCRM`, `HohohSolutions CRM`) worden bij installatie opgeruimd.

## SaaS: PKG-downloader & release-manifest

- **Manifest (bron van waarheid):** `webapp/public/releases/nebula-release-manifest.json` — vul na elke release de publieke `url`-velden (CDN / S3 / GitHub Releases) en zo mogelijk `sha256` + `bytes`.
- **Checksums vullen (lokaal):** na `./scripts/build.sh all` en eventueel `build-full-package.sh`:  
  `BASE_URL=https://cdn.jouwdomein.com/nebula/v1.0.0 npm run fill-manifest`  
  (zonder `BASE_URL` worden alleen hash en grootte gezet; URLs vul je handmatig.)
- **API:** met de backend actief: `GET http://localhost:4000/v1/releases/latest` —zelfde JSON als het manifest (handig voor portals en scripts).
- **Download-CLI (macOS, vereist `jq`):**  
  `NEBULA_API_BASE=http://127.0.0.1:4000 ./scripts/download-nebula-pkg.sh`  
  of direct: `NEBULA_MANIFEST_URL=https://…/nebula-release-manifest.json ./scripts/download-nebula-pkg.sh -t dmg`  
  Opties: `-i` opent installer na download, `-n` slaat hash-check over.
- **Node-CLI:** `npm run download-pkg:node -- --file webapp/public/releases/nebula-release-manifest.json -t pkg`
- **Downloadpagina (statisch):** na `webapp` build: `/downloads/` — toont knoppen op basis van het manifest (Netlify-rewrite staat in `netlify.toml`).

Zie **`SECURITY.md`** voor HTTPS, CORS, rate limits, `INTERNAL_API_KEY`, installers (checksums / signing) en roadmap (JWT, CSP, …).

**Centraal beheer (SaaS):** met `INTERNAL_API_KEY` kun je via `PUT /v1/admin/platform-config` o.a. `releaseManifestPatch`, `featureFlags`, `brandingDefaults` en `messages` bijwerken — zonder nieuwe webbuild. Clients lezen publieke defaults via `GET /v1/public/settings`. Zie `backend/README.md`.

## SaaS-backend (fundament)

Zie **`backend/README.md`** en **`backend/sql/001_core.sql`**: PostgreSQL-schema voor tenants, users, memberships — startpunt voor echte multi-tenant API (auth, Stripe, AI volgen in aparte iteraties).

## Belangrijke mappen

| Map | Inhoud |
|-----|--------|
| `webapp/` | Product-UI (Nebula) |
| `macos-native/` | Swift-wrapper |
| `marketing/` | Landingspagina (`hohohsolutions-website.html`) |
| `netlify/functions/` | o.a. opvolgmail |
| `backend/` | API-skelet + SQL-schema |
| `updates/` | Sparkle appcast-sjabloon |

## Licentie / merk

Product: **Nebula**. Bedrijf: **HohohSolutions**. Zie installatie-license in `scripts/build.sh` resources.

© 2026 HohohSolutions — Alle rechten voorbehouden.
