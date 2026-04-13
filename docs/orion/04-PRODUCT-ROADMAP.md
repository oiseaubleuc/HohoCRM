# Orion — pricing, premium, roadmap

## Suggested pricing (B2B SaaS)

| Tier | Price anchor (EUR/mo, excl. VAT) | Seats | Positioning |
|------|-----------------------------------|-------|-------------|
| **Starter** | €29–49 | 1–3 | Solopreneurs, single pipeline |
| **Team** | €79–129 | up to 10 | Agencies, shared projects + tasks |
| **Business** | €199–299 | up to 25 | Finance seat, approvals, reporting |
| **Enterprise** | Custom | Unlimited | SSO, SLA, dedicated support |

Billing: per workspace (tenant) + optional **per-seat** add-ons for **Finance** and **Admin** roles.

## Premium / higher-tier features

- **Advanced reporting** — cohort revenue, utilization, forecast vs actuals  
- **Automations** — triggers (invoice overdue → task, meeting follow-up templates)  
- **Peppol / e-invoicing** — already on your roadmap; gate as Business+  
- **API access** — webhooks + API keys (Team+)  
- **White-label** — logo, colors, custom domain (Business+)  
- **Audit export** — immutable activity export for compliance (Business+)  
- **SSO / SCIM** — Enterprise  

## Roadmap

### v1 — Production core (8–12 weeks)

- Auth (JWT + refresh), tenant onboarding, RBAC enforcement  
- Clients, projects, tasks (list + kanban), invoices (lifecycle), meetings + **convert action to task**  
- Dashboard KPIs + action center + activity feed  
- Global search (Postgres), notifications (in-app), pagination everywhere  

### v2 — Depth & collaboration

- Calendar view for tasks, recurring tasks, time tracking (optional module)  
- File attachments, richer project budget vs actuals  
- Email ingest for meeting notes (optional), comment threads on tasks  
- Stripe billing + plan limits, usage meters  

### v3 — Platform

- Public API + webhooks, workflow builder, custom fields  
- Multi-currency + consolidated reporting, advanced analytics warehouse  
- Mobile companion (React Native or PWA), offline-first experiments  

Use **feature flags** (you already have `platform-config` / `featureFlags`) to roll out tier-gated behavior without blocking trunk development.
