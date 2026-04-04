# Nebula — webapp

Productie-webapp (**Nebula** by **HohohSolutions**): Vite + vanilla JS (`public/crm-app.js`), premium dark UI.

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

Output: `dist/` (o.a. `index.html`, `crm-app.js`, `invoice-pdf.js`).

## Belangrijke bestanden

| Pad | Rol |
|-----|-----|
| `index.html` | Shell + pagina’s |
| `public/crm-app.js` | Applicatielogica |
| `public/invoice-pdf.js` | PDF-factuur; branding via `nebula_invoice_branding` (legacy: `hohoh_invoice_branding`) |
| `src/styles/app.css` | Nebula design tokens |
| `src/main.js` | CSS + thema (`nebula-theme`) |

## Thema

LocalStorage: `nebula-theme` (`light` / `dark`); oude `hohoh-theme` wordt nog gelezen voor migratie.
