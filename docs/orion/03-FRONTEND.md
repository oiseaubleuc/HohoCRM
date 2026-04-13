# Orion — Next.js frontend layout

Target stack: **Next.js (App Router)**, **Tailwind CSS**, **TypeScript**. The app talks to the **Express API** via a typed fetch layer (no Prisma in the browser).

## Folder structure

```
apps/orion-web/
├── src/
│   ├── app/
│   │   ├── (marketing)/          # public landing, legal
│   │   ├── (auth)/               # login, register, forgot-password
│   │   ├── (app)/                # authenticated shell
│   │   │   ├── layout.tsx        # sidebar + header + tenant switcher
│   │   │   ├── dashboard/
│   │   │   ├── clients/
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   ├── meetings/
│   │   │   ├── invoices/
│   │   │   ├── search/
│   │   │   └── settings/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # Button, Input, Badge, Card, EmptyState, DataTable
│   │   ├── layout/               # AppShell, Sidebar, TopBar, CommandPalette
│   │   └── domain/               # ClientForm, ProjectBoard, InvoiceStatusBadge, …
│   ├── lib/
│   │   ├── api.ts                # base URL, auth headers, error parsing
│   │   ├── hooks/                # useTenant, useDebounce
│   │   └── utils.ts
│   └── types/
│       └── api.ts                # DTOs shared with OpenAPI / Zod
├── public/
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## Routes (App Router)

| Path | Purpose |
|------|---------|
| `/dashboard` | KPIs, action center, activity, quick actions |
| `/clients`, `/clients/[id]` | List + detail (tabs: overview, projects, invoices, tasks, meetings) |
| `/projects`, `/projects/[id]` | List + detail (tasks, notes, invoices) |
| `/tasks` | Tabs or subroutes: `/tasks/list`, `/tasks/board`, `/tasks/calendar` |
| `/meetings`, `/meetings/[id]` | Detail + convert action → task |
| `/invoices`, `/invoices/[id]` | List + PDF / send actions |
| `/search` | Global search results (grouped) |
| `/settings/team` | Members + roles |
| `/settings/billing` | Plan, Stripe portal (later) |

## UI system (Linear / Notion-like)

- **CSS variables** for background, surface, border, text, accent (single brand hue + neutrals).
- **Radius** `0.5rem` cards, **shadow** `0 1px 2px rgb(0 0 0 / 0.05)` + subtle hover lift on cards.
- **Badges**: semantic mapping — success (paid, done), warning (sent, in progress), danger (overdue, blocked), info (draft), neutral (archived).
- **Empty states**: illustration or icon, one sentence, primary CTA (e.g. “Add your first client”).
- **Responsive**: collapsible sidebar under `md`, tables become card lists on small screens.

## Data loading

- **Server Components** for initial layout and SEO-safe shells where useful.
- **Client** data for interactive views (kanban, calendar): `useSWR` or TanStack Query with stable keys `['tasks', tenantId, filters]`.
- **Optimistic updates** for task status and invoice transitions.

## Command palette (global search v2)

`Cmd+K` → fuzzy search hitting `/v1/search` + local recent items; opens entity drawer or navigates.

## Coexistence with `webapp/` (Vite)

The existing Vite **Orion** build can remain the downloadable/desktop shell. The **Next.js** app is the recommended **cloud SaaS** UI; both can share design tokens via a small `packages/design-tokens` package later.
