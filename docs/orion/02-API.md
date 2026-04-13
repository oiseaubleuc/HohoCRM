# Orion — REST API structure

Conventions: **JSON**, version prefix **`/v1`**, tenant from **`Authorization: Bearer <jwt>`** (claim `tenant_id` or `active_tenant_id`) or `X-Tenant-Id` after session resolution. Pagination: `?cursor=` or `?page=&limit=`; sorting: `?sort=field` and `?order=asc|desc`.

## Auth

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/auth/register` | Create user + optional first tenant |
| POST | `/v1/auth/login` | Issue access (+ refresh) token |
| POST | `/v1/auth/refresh` | Rotate tokens |
| POST | `/v1/auth/logout` | Invalidate refresh |
| GET | `/v1/auth/me` | Current user + memberships |

## Dashboard (aggregates)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/dashboard/kpis` | KPI cards + period + trend vs previous period |
| GET | `/v1/dashboard/actions` | Urgent tasks, overdue invoices, projects near deadline, today’s meetings |
| GET | `/v1/dashboard/activity` | Recent `ActivityLog` (paginated) |

## Clients

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/clients` | List + filter (status, tag, manager) + search |
| POST | `/v1/clients` | Create |
| GET | `/v1/clients/:id` | Detail + aggregates (revenue, outstanding, last contact) |
| PATCH | `/v1/clients/:id` | Update |
| DELETE | `/v1/clients/:id` | Soft delete |
| GET | `/v1/clients/:id/projects` | Related projects |
| GET | `/v1/clients/:id/invoices` | Invoice history |
| GET | `/v1/clients/:id/tasks` | Related tasks |
| GET | `/v1/clients/:id/meetings` | Meetings |

## Projects

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/projects` | List + filters |
| POST | `/v1/projects` | Create |
| GET | `/v1/projects/:id` | Detail + members + notes count |
| PATCH | `/v1/projects/:id` | Update |
| DELETE | `/v1/projects/:id` | Soft delete |
| POST | `/v1/projects/:id/members` | Add member |
| DELETE | `/v1/projects/:id/members/:userId` | Remove |
| GET | `/v1/projects/:id/notes` | Notes list |
| POST | `/v1/projects/:id/notes` | Create note |

## Tasks

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/tasks` | List + filters; `view=list` default |
| GET | `/v1/tasks?view=kanban` | Grouped columns by status |
| GET | `/v1/tasks?view=calendar` | ISO range `from` / `to` on `due_date` |
| POST | `/v1/tasks` | Create |
| GET | `/v1/tasks/:id` | Detail |
| PATCH | `/v1/tasks/:id` | Update (status, assignee, dates) |
| DELETE | `/v1/tasks/:id` | Soft delete |

## Meetings

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/meetings` | List |
| POST | `/v1/meetings` | Create + participants + action items |
| GET | `/v1/meetings/:id` | Detail |
| PATCH | `/v1/meetings/:id` | Update |
| POST | `/v1/meetings/:id/action-items/:itemId/convert-task` | Create `Task`, set `MeetingActionItem.task_id` |

## Invoices

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/invoices` | List + status filter |
| POST | `/v1/invoices` | Create draft |
| GET | `/v1/invoices/:id` | Detail |
| PATCH | `/v1/invoices/:id` | Update; transitions `draft→sent`, `sent→paid`, etc. |
| POST | `/v1/invoices/:id/send` | Mark sent + side effects (email, Peppol) |

## Search

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/search?q=` | Grouped hits: clients, projects, tasks, invoices, notes |

Implementation: PostgreSQL `ILIKE` / `tsvector` per table for v1; optional Meilisearch later.

## Activity & notifications

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/activity` | Full activity log (admin/manager) |
| GET | `/v1/notifications` | For current user |
| PATCH | `/v1/notifications/:id/read` | Mark read |

## RBAC (middleware matrix)

Default policy (adjust per product):

| Module | OWNER/ADMIN | MANAGER | EMPLOYEE | FINANCE | VIEWER |
|--------|-------------|---------|----------|---------|--------|
| Clients | CRUD | CRUD | R / assigned | R | R |
| Projects | CRUD | CRUD | R / member | R | R |
| Tasks | CRUD | CRUD | CRUD own / project | R | R |
| Meetings | CRUD | CRUD | CRUD if participant | R | R |
| Invoices | CRUD | R | — | CRUD | R |
| Users / billing | CRUD | invite | — | — | — |

Enforce in a single `assertPermission(module, action)` used by route handlers.

## Error shape

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "…",
    "details": {}
  }
}
```

HTTP: `400` validation, `401` unauthenticated, `403` RBAC, `404` not found, `409` conflict (e.g. duplicate invoice number).
