# Orion — by HohoSolutions

**Lokale mapnaam:** je mag deze repository-map hernoemen (bijv. naar `orion-platform`). Cursor/VS Code tonen bovenaan de verkenner de **mapnaam**; die wijzig je in Finder of door de map te verplaatsen/hernoemen — niet via `package.json`.

Monorepo voor **Orion ERP**: operations-platform (relaties, voorraad/artikelen, projecten, finance, agenda, Peppol). Dit pakket bevat de **webapp** (Vite), **macOS native wrapper** (Swift + WKWebView), **marketing/vitrine**, **Netlify functions**, en een begin **backend/SaaS-fundament** (`backend/`), plus de **Next.js SaaS-UI** in `apps/orion-web/`.

**Waar staat welke data?** (localStorage, Netlify Blobs, Postgres, platform-config) — zie **`DATA.md`**.

## Snel starten (webapp)

```bash
cd webapp
npm install
npm run dev
```

Open de dev-server-URL; productnaam in de UI: **Orion** · **by HohoSolutions**.

## macOS-app bouwen

```bash
./scripts/build-native-mac-app.sh
```

Levert onder andere `artifacts/Orion Native.app` en `artifacts/Te-testen/Orion.app`.

## Installer (.pkg / .dmg)

```bash
./scripts/build.sh        # .pkg
./scripts/build.sh dmg    # .dmg
```

Output o.a. `artifacts/Orion-v1.0.0.pkg` — installeert **`/Applications/Orion.app`**. Oude installaties (o.a. **Nebula**, `HOHOSOLUTIONCRM`, `HohohSolutions CRM`) worden bij installatie opgeruimd.

## SaaS: PKG-downloader & release-manifest

- **Manifest (bron van waarheid):** `webapp/public/releases/orion-release-manifest.json` — vul na elke release de publieke `url`-velden (CDN / S3 / GitHub Releases) en zo mogelijk `sha256` + `bytes`.
- **Checksums vullen (lokaal):** na `./scripts/build.sh all` en eventueel `build-full-package.sh`:  
  `BASE_URL=https://cdn.jouwdomein.com/orion/v1.0.0 npm run fill-manifest`  
  (zonder `BASE_URL` worden alleen hash en grootte gezet; URLs vul je handmatig.)
- **API:** met de backend actief: `GET http://localhost:4000/v1/releases/latest` —zelfde JSON als het manifest (handig voor portals en scripts).
- **Download-CLI (macOS, vereist `jq`):**  
  `ORION_API_BASE=http://127.0.0.1:4000 ./scripts/download-orion-pkg.sh`  
  of direct: `ORION_MANIFEST_URL=https://…/orion-release-manifest.json ./scripts/download-orion-pkg.sh -t dmg`  
  Opties: `-i` opent installer na download, `-n` slaat hash-check over.
- **Node-CLI:** `npm run download-pkg:node -- --file webapp/public/releases/orion-release-manifest.json -t pkg`
- **Downloadpagina (statisch):** na `webapp` build: `/downloads/` — toont knoppen op basis van het manifest (Netlify-rewrite staat in `netlify.toml`).

Zie **`SECURITY.md`** voor HTTPS, CORS, rate limits, `INTERNAL_API_KEY`, installers (checksums / signing) en roadmap (JWT, CSP, …).

**Centraal beheer (SaaS):** met `INTERNAL_API_KEY` kun je via `PUT /v1/admin/platform-config` o.a. `releaseManifestPatch`, `featureFlags`, `brandingDefaults` en `messages` bijwerken — zonder nieuwe webbuild. Clients lezen publieke defaults via `GET /v1/public/settings`. Zie `backend/README.md`.

## SaaS-backend (fundament)

Zie **`backend/README.md`** en **`backend/sql/001_core.sql`**: PostgreSQL-schema voor tenants, users, memberships — startpunt voor echte multi-tenant API (auth, Stripe, AI volgen in aparte iteraties). Next.js-dashboard: **`apps/orion-web/`**.

## Belangrijke mappen

| Map | Inhoud |
|-----|--------|
| `webapp/` | Product-UI (Orion, Vite) |
| `apps/orion-web/` | SaaS-dashboard (Next.js) |
| `macos-native/` | Swift-wrapper |
| `marketing/` | Landingspagina (`hohohsolutions-website.html`) |
| `netlify/functions/` | o.a. opvolgmail |
| `backend/` | API-skelet + SQL-schema |
| `docs/orion/` | SaaS-architectuur & API-notities |
| `updates/` | Sparkle appcast-sjabloon |

## Licentie / merk

Product: **Orion**. Bedrijf: **HohohSolutions**. Zie installatie-license in `scripts/build.sh` resources.

© 2026 HohohSolutions — Alle rechten voorbehouden.
