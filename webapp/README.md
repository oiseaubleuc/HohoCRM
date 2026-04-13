# Orion — webapp

Productie-webapp (**Orion ERP** by **HohoSolutions**): Vite + vanilla JS (`public/crm-app.js`), premium dark UI.

## Ontwikkelen

```bash
cd webapp
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output: `dist/` (o.a. `index.html`, `crm-app.js`, `invoice-pdf.js`, `orion-logo.png`).

## Belangrijke bestanden

| Pad | Rol |
|-----|-----|
| `index.html` | Shell + pagina’s |
| `public/crm-app.js` | Applicatielogica |
| `public/invoice-pdf.js` | PDF-factuur; branding via `orion_invoice_branding` (legacy: `nebula_invoice_branding`, `hohoh_invoice_branding`) |
| `public/lib/orion-ubl-generator.js` | UBL 2.1 (`window.OrionUBL`) |
| `public/lib/orion-peppol-client.js` | Digiteal Peppol (`window.OrionPeppol`) |
| `src/styles/app.css` | Orion design tokens |
| `src/main.js` | CSS + thema (`orion-theme`; legacy `nebula-theme` wordt nog gelezen) |

## Thema

LocalStorage: `orion-theme` (`light` / `dark`); legacy `nebula-theme` en `hohoh-theme` worden nog gelezen bij eerste bezoek.
