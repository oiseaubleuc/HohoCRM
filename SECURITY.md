# Security — Nebula / HohohSolutions

Korte richtlijnen voor SaaS en distributie van macOS-builds.

## Transport en hosting

- Draai de **API alleen achter HTTPS** in productie. Zet `ENABLE_HSTS=1` alleen als je hele site TLS is en subdomeinen meedoet.
- Zet **`TRUST_PROXY=1`** op de API als je achter een reverse proxy zit (zodat rate limits op het echte client-IP gebaseerd zijn).

## Geheimen

- Bewaar **geen secrets** in `nebula-release-manifest.json` of in de frontend; dat bestand is publiek.
- Gebruik `INTERNAL_API_KEY` voor beheer-endpoints totdat echte **JWT + tenant-scopes** live zijn.
- `.env` staat in `.gitignore` — roteer gelekte sleutels onmiddellijk.

## Downloads (.pkg / .dmg)

- Host installers op **HTTPS** (CDN/S3/R2/GitHub Releases).
- Houd **`sha256`** in het manifest bij; de downloader-scripts controleren die checksum.
- Voor maximale controle: **tijdelijk ondertekende URLs** (presigned) in het manifest i.p.v. permanente publieke links, en manifest via API achter lichte auth (toekomstige uitbreiding).
- **Code signing + notarisatie** van de macOS-app blijven nodig voor gebruikersvertrouwen (Apple Gatekeeper).

## Platform-beheer (`/v1/admin/*`)

- Alleen met **sterke `INTERNAL_API_KEY`**; nooit in frontend of manifest-bestanden zetten.
- `platform-config.json` kan **branding- en download-URL’s** bevatten — beperk toegang op schijf/backups.

## API (Express)

- Standaard **security headers** (o.a. `X-Frame-Options: DENY`, `nosniff`).
- **Rate limiting** op publieke routes (in-memory; bij schaal: Redis).
- Productie: **geen stack traces** of serverpaden naar clients.
- `CORS_ORIGIN`: in productie expliciet je frontend-URL zetten i.p.v. `*`.

## Web (Netlify / static)

- Basis **security headers** via `netlify.toml` op `/*`.
- Een strikte **CSP** breekt de huidige CRM (veel inline handlers); later: refactoren naar bundelde JS en dan CSP aanscherpen.

## Roadmap (aanbevolen)

- Auth: OAuth2/OIDC of JWT met refresh, **bcrypt** voor wachtwoorden, rate limit op login.
- **RBAC** per tenant; auditlog voor factuur/export-acties.
- **Dependency updates** (`npm audit`) en CI security scan.
- **DDoS / WAF** op edge (Cloudflare, Netlify Enterprise, …) voor productie.

Meldingen: neem contact op via je gebruikelijke supportkanaal; voeg geen kwetsbaarheden in publieke issues toe tot ze zijn verholpen.
