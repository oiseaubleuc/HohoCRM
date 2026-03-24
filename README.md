# HohohSolutions CRM — macOS builder + webapp

Repository met een **volledige webapp** (Vite + vanilla JS) en scripts om een **macOS `.pkg`-installer** en/of **`.dmg`** te bouwen. Daarnaast: een **volledige native Mac-app** (Swift + WKWebView) in één venster.

---

## Projectstructuur

```
hohoh-pkg-builder/
├── webapp/                    ← Broncode van de CRM-webapp
│   ├── index.html
│   ├── public/crm-app.js      Applicatielogica
│   ├── src/main.js            Vite-entry (importeert CSS)
│   ├── src/styles/app.css
│   ├── package.json
│   └── README.md              Details: dev/build
├── macos-native/              ← Native Mac-app (SwiftUI + WebKit)
│   ├── Package.swift
│   ├── Info.plist
│   └── Sources/HohohSolutionsCRMNative/
├── build.sh                   Bouwt webapp + native app + .pkg / .dmg (installeert echte Mac-app)
├── build-native-mac-app.sh    Bouwt HohohSolutions CRM Native.app (Swift + WKWebView)
├── build-full-package.sh      Bouwt volledige releasebundel in releases/
├── generate_icon.py
└── payload/Applications/...   Oude launcher-template (referentie; installer gebruikt native build)
```

### Native Mac-app (aanbevolen als “echte” desktop-app)

```bash
chmod +x build-native-mac-app.sh
./build-native-mac-app.sh
```

Levert **`HohohSolutions CRM Native.app`**: de CRM draait **in een macOS-venster** (WKWebView). Er wordt **geen** Safari/Chrome geopend. Een kleine ingebouwde HTTP-server draait alleen **binnen de app** (localhost) zodat `localStorage` betrouwbaar werkt.

**Automatische updates (Sparkle):** ingebouwd. Stel `SUFeedURL` en `SUPublicEDKey` in `macos-native/Info.plist` in, host een `appcast.xml` + getekende zip op HTTPS, en gebruik `./publish-mac-update.sh <versie>`. Volledige stappen: [`updates/SPARKLE-UPDATES.md`](updates/SPARKLE-UPDATES.md).

**Français :** même commande — application **macOS complète** avec interface intégrée (pas seulement un raccourci vers le navigateur).

**Lokaal ontwikkelen:**

```bash
cd webapp
npm install
npm run dev
```

Open http://localhost:5173 — hot reload tijdens bewerken.

---

## Vereisten (macOS-build)

- macOS **13.0** of nieuwer (native app)
- **Node.js + npm** (https://nodejs.org) — voor `npm run build` in `webapp/`
- Xcode Command Line Tools (`xcode-select --install`) — o.a. **Swift** voor de native app
- **Python 3** — alleen nodig op de **bouwmachine** om `AppIcon.icns` te genereren (`generate_icon.py`); de geïnstalleerde klant-app vereist geen Python

---

## macOS-artefacten bouwen

```bash
chmod +x build.sh
```

| Commando | Resultaat |
|----------|-----------|
| `./build.sh` | `.pkg` (installeert naar `/Applications`) |
| `./build.sh dmg` | `.dmg` (app slepen naar Programma’s) |
| `./build.sh all` | beide |

Het script bouwt de webapp, daarna **`build-native-mac-app.sh`** (Swift), en plaatst het resultaat als **`/Applications/HohohSolutions CRM.app`** in de installer (zelfde UI als de webapp, maar **in een eigen venster**, niet in je standaardbrowser).

---

## Full package (alles in 1)

Gebruik dit als je een complete klantrelease wil:

```bash
chmod +x build-full-package.sh
./build-full-package.sh
```

Output komt in `releases/HohoCRM-FullPackage-v.../` met:
- `installers/` → `.pkg` + `.dmg`
- `native/` → `HohohSolutions CRM Native.app`
- `webapp/` → deploy-klare `dist`
- `vitrine/` → vitrine website HTML
- `SHA256SUMS.txt`
- `README-CUSTOMER.txt`

---

## Friendly use (zonder technische kennis)

1. Dubbelklik op `build-easy.command`
2. Kies een nummer in het menu:
   - `1` webapp
   - `2` Mac installer
   - `3` Native Mac app
   - `4` Volledig pakket

Voor klantenlevering kies je meestal `4`.

---

## Eindgebruiker (geïnstalleerde app)

- Dubbelklik op **HohohSolutions CRM**: je krijgt **een normaal macOS-venster** met de CRM (WebKit). Er wordt **geen** apart browservenster geopend.
- Technisch draait er nog steeds een **mini HTTP-server op localhost** *binnen de app* — dat is normaal en lokaal; het is geen “website op het internet”.

---

## Code signing (optioneel)

```bash
productsign \
  --sign "Developer ID Installer: JOUW NAAM (TEAMID)" \
  HohohSolutions-CRM-v1.0.0.pkg \
  HohohSolutions-CRM-v1.0.0-signed.pkg
```

---

© 2026 HohohSolutions — Alle rechten voorbehouden
