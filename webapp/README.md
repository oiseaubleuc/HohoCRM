# HohohSolutions CRM — webapp

Vanilla JavaScript CRM met Vite voor ontwikkeling en productie-build.

## Scripts

| Commando | Omschrijving |
|----------|----------------|
| `npm install` | Dependencies installeren |
| `npm run dev` | Dev-server (http://localhost:5173), hot reload |
| `npm run build` | Statische site naar `dist/` (gebruikt door macOS `.pkg` / `.dmg`) |
| `npm run preview` | Lokale preview van de build |

## Structuur

```
webapp/
├── index.html          Shell + markup
├── public/
│   ├── crm-app.js      Applicatielogica (globale handlers voor inline onclick)
│   └── invoice-pdf.js  PDF-export factuur (html2pdf + QR); branding via localStorage `hohoh_invoice_branding`
├── src/
│   ├── main.js         Entry: importeert alleen CSS
│   └── styles/
│       └── app.css     Volledige UI-styling
└── dist/               (na build) output voor de Mac-app
```

## macOS-app

Vanaf de **repository root**: `./build.sh` of `./build.sh dmg` bouwt de webapp automatisch (`npm run build`) en kopieert `dist/` naar `Resources/` in de app bundle.
