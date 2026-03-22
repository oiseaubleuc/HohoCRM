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
├── build.sh                   Bouwt webapp + .pkg / .dmg (browser-launcher app)
├── build-native-mac-app.sh    Bouwt HohohSolutions CRM Native.app (echte venster-app)
├── generate_icon.py
└── payload/Applications/...   Template voor de browser-gebaseerde .app
```

### Native Mac-app (aanbevolen als “echte” desktop-app)

```bash
chmod +x build-native-mac-app.sh
./build-native-mac-app.sh
```

Levert **`HohohSolutions CRM Native.app`**: de CRM draait **in een macOS-venster** (geen aparte browser). Er wordt lokaal nog steeds **Python 3** gebruikt voor `http://127.0.0.1` (localStorage), net als bij de andere variant.

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

- macOS 11.0 of nieuwer
- **Node.js + npm** (https://nodejs.org) — voor `npm run build` in `webapp/`
- Xcode Command Line Tools (`xcode-select --install`)
- Python 3 (launcher + optioneel Pillow voor icoon)

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

Het script draait automatisch **`npm install` / `npm ci`** en **`npm run build`** in `webapp/`, en kopieert **`webapp/dist/`** naar `HohohSolutions CRM.app/Contents/Resources/`.

---

## Eindgebruiker (geïnstalleerde app)

- De app start een **lokale webserver** op `http://127.0.0.1` en opent de CRM in de browser (nodig voor **`localStorage`**; `file://` werkt niet betrouwbaar).
- **Python 3** moet op de Mac staan (`xcode-select --install`).

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
