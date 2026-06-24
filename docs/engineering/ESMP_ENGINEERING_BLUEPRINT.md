# ESMP Engineering Blueprint

| Attribute | Value |
|---|---|
| Document Version | 1.0 |
| Date | 2026-06-23 |
| Authors | Principal Software Architect, Staff Engineer |
| Status | **Implementation-ready** |
| Scope | **Gen-1 Production MVP** (frozen) |

### Source Documents (frozen / approved)

| Document | Role in this blueprint |
|---|---|
| [ESMP_ARCHITECTURE_v2.md](../architecture/ESMP_ARCHITECTURE_v2.md) | Target-state patterns: Work Item spine, Graph email, audit, SLA semantics, deployment topology |
| [ESMP_PRD.md](../product/ESMP_PRD.md) v1.2 | Functional requirements, business rules, acceptance criteria, screen inventory |
| [ESMP_PRODUCTION_MVP_REVIEW.md](../product/ESMP_PRODUCTION_MVP_REVIEW.md) v1.0 | **Authoritative Gen-1 scope** — supersedes PRD §14 for implementation sequencing and deferrals |

### Gen-1 governing decisions

| Decision | Gen-1 choice | Deferred |
|---|---|---|
| Data model | **Option A**: `work_items` + extension tables | Custom fields, relations, watchers |
| Workflows | **Code-defined** Python state machines (2 types) | DB workflow builder, admin designer |
| Side effects | **Synchronous** audit + notifications in request path | Outbox, Redis Streams, idempotent consumers |
| Async | **Celery** for email parse + SLA cron only | Platform event bus |
| RBAC | **5 roles** | 12 roles, ABAC, SSO |
| Search | PostgreSQL `ILIKE` + `display_id` lookup | OpenSearch |
| Attachments | Local disk or single MinIO bucket | ClamAV, versioning, signed URLs |
| Concurrency | `updated_at` optional check; no merge UI | `lock_version`, Idempotency-Key API |

**Team assumption**: 5 engineers (2 BE, 2 FE, 1 full-stack/DevOps), 1 PM, 1 QA part-time. **Timeline**: 5–7 months to Gen-1 go-live.

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Backend Architecture](#2-backend-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [FastAPI Module Layout](#4-fastapi-module-layout)
5. [React Module Layout](#5-react-module-layout)
6. [Database Migration Strategy](#6-database-migration-strategy)
7. [API Design Standards](#7-api-design-standards)
8. [Event Design](#8-event-design)
9. [Service Layer Design](#9-service-layer-design)
10. [Background Job Design](#10-background-job-design)
11. [Testing Strategy](#11-testing-strategy)
12. [CI/CD Strategy](#12-cicd-strategy)
13. [Environment Strategy](#13-environment-strategy)
14. [Sprint Breakdown](#14-sprint-breakdown)

---

## 1. Repository Structure

### 1.1 Monorepo layout

Greenfield FastAPI + React lives alongside the legacy Node reference (`server/`, `client/`) until cutover. Gen-1 is built in a **new top-level tree**; legacy code is read-only reference for email parsing, priority matrix, and state machines.

```
ITSM/
├── docs/
│   ├── architecture/          # ESMP_ARCHITECTURE_v2.md (frozen)
│   ├── product/               # PRD, MVP review, build prompts
│   └── engineering/           # This blueprint
│
├── esmp/                      # Gen-1 application (NEW — primary development)
│   ├── backend/
│   │   ├── alembic/           # Migrations
│   │   ├── app/
│   │   │   ├── api/           # HTTP routers (thin)
│   │   │   ├── core/          # Config, security, logging, deps
│   │   │   ├── domain/        # Enums, constants, workflow defs
│   │   │   ├── models/        # SQLAlchemy ORM
│   │   │   ├── schemas/       # Pydantic request/response
│   │   │   ├── services/      # Business logic
│   │   │   ├── workers/       # Celery tasks
│   │   │   └── main.py
│   │   ├── tests/
│   │   ├── pyproject.toml     # or requirements + poetry
│   │   └── Dockerfile
│   │
│   ├── frontend/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── Dockerfile
│   │
│   ├── infra/
│   │   ├── docker-compose.yml       # dev: postgres, redis, api, worker, beat, web
│   │   ├── docker-compose.prod.yml  # single-VM production
│   │   └── nginx/
│   │       └── esmp.conf            # TLS, rate limit, static + API proxy
│   │
│   └── scripts/
│       ├── seed_dev.py
│       ├── import_users.py          # F-38 cutover helper
│       └── graph_subscription_renew.sh
│
├── server/                    # LEGACY — Node/Express/Prisma (reference only)
├── client/                    # LEGACY — React prototype (patterns only)
├── .github/workflows/         # CI pipelines
└── README.md                  # Points to esmp/ for Gen-1
```

### 1.2 Package boundaries

| Package | Owns | Must not own |
|---|---|---|
| `backend/app/api` | HTTP routing, auth deps, request validation, response mapping | Business rules, DB transactions spanning modules |
| `backend/app/services` | Use cases, orchestration, domain rules | HTTP concerns |
| `backend/app/models` | ORM mappings, relationships | API DTOs |
| `backend/app/workers` | Celery entrypoints | Complex logic (delegate to services) |
| `frontend/src/features` | UI per domain module | Direct DB access |
| `frontend/src/api` | OpenAPI-generated or hand-written API client | Business rules |

### 1.3 Naming conventions

| Artifact | Convention | Example |
|---|---|---|
| Python modules | `snake_case` | `work_item_service.py` |
| API paths | kebab-case, versioned | `/api/v1/work-items/{id}/transitions` |
| DB schemas | PostgreSQL schemas per bounded context | `identity`, `work_item`, `sla`, `email`, `audit` |
| React components | PascalCase | `TicketDetailPanel.tsx` |
| Feature folders | domain name | `features/incidents/` |
| Env vars | `ESMP_` prefix | `ESMP_DATABASE_URL` |

### 1.4 Legacy reference map

Port logic, not structure, from the Node prototype:

| Legacy file | Gen-1 target |
|---|---|
| `server/src/services/emailInbound.js` | `services/email/graph_ingest_service.py` |
| `server/src/services/priorityMatrix.js` | `services/incident/priority_service.py` |
| `server/src/config/stateMachines.js` | `domain/workflows/incident.py`, `domain/workflows/change.py` |
| `server/src/middleware/rbac.js` | `core/security/permissions.py` |
| `server/src/services/slaCalculator.js` | `services/sla/sla_engine.py` |

---

## 2. Backend Architecture

### 2.1 Layered architecture

```
┌─────────────────────────────────────────────────────────────┐
│  API Layer (FastAPI routers)                               │
│  — auth, RBAC deps, Pydantic validation, HTTP status codes   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Service Layer (use cases)                                  │
│  — transactions, workflow guards, SLA hooks, notifications   │
└──────────┬───────────────────────────────┬────────────────────┘
           │                               │
┌──────────▼──────────┐         ┌──────────▼──────────┐
│  Repository / ORM   │         │  Integrations        │
│  SQLAlchemy 2       │         │  Graph, file storage │
└──────────┬──────────┘         └─────────────────────┘
           │
┌──────────▼──────────┐
│  PostgreSQL 16      │
└─────────────────────┘
```

**Rule**: Routers never call ORM directly except health checks. All mutations flow through a service method that owns the transaction boundary.

### 2.2 Request lifecycle (synchronous mutation)

1. **Authenticate** — JWT from HttpOnly cookie; load user + roles.
2. **Authorize** — RBAC + scope check (requester owns ticket vs agent group scope).
3. **Validate** — Pydantic schema; workflow transition pre-checks.
4. **Execute** — Service opens DB transaction:
   - Persist entity change
   - Write audit row (same transaction)
   - Invoke SLA hooks (pause/resume, first response)
   - Send notifications (sync: in-app row + Graph sendMail queue task OR inline for Gen-1 critical path)
5. **Commit** — Return response DTO.
6. **Log** — Structured JSON log with `request_id`, `actor_id`, `entity_id` (PII redacted).

Gen-1 **does not** publish to outbox. Notification email is enqueued to Celery **after** commit to avoid double-send on rollback.

### 2.3 Cross-cutting concerns

| Concern | Implementation |
|---|---|
| Authentication | JWT access (15 min) + refresh (7 days), HttpOnly Secure SameSite=Strict cookies |
| Authorization | Role + resource scope middleware; deny by default |
| Audit | `AuditService.log()` called from every mutating service method |
| Logging | `structlog` JSON; correlation ID via middleware |
| Errors | RFC 7807 Problem Details (`application/problem+json`) |
| Time | All timestamps UTC in DB; convert to org timezone in API/UI |
| File uploads | Stream to disk/MinIO; metadata in `attachments` table |

### 2.4 Integration: Microsoft Graph

| Flow | Pattern |
|---|---|
| Inbound webhook | FastAPI endpoint returns `validationToken` within 5s; enqueue `process_graph_notification` Celery task |
| Fetch message | App-only client credentials; `GET /users/{mailbox}/messages/{id}` |
| Send mail | `POST /users/{mailbox}/sendMail` — internal M365 only |
| Subscription renewal | Celery Beat daily; recreate before expiry (~2 days) |
| Fallback | Delta poll every 60s when webhook unhealthy |

### 2.5 Scalability posture (Gen-1)

| Dimension | Gen-1 | Trigger to evolve |
|---|---|---|
| API instances | 1–2 behind Nginx | p95 > 500ms sustained |
| Workers | 1 Celery worker + Beat | Email backlog > 2 min |
| DB | Single PostgreSQL | > 50k tickets or search pain |
| Redis | Broker + optional session cache | Phase 2 outbox |

Target: **100–300 users**, **99% availability**, single VM or Docker Compose acceptable.

### 2.6 Security baseline

- Secrets in env / vault; never in repo
- Graph credentials: Azure AD app registration with application permissions
- Rate limit: login (5 fails / 15 min lockout), ticket create (20/requester/24h per BR-ABUSE-001)
- CORS: explicit frontend origin only
- Attachment size cap: 25 MB (Gen-1; no ClamAV)
- Webhook endpoint: validate Graph client state; no auth bypass

---

## 3. Frontend Architecture

### 3.1 Stack

| Layer | Choice |
|---|---|
| Framework | React 18+ |
| Language | TypeScript (strict) |
| Build | Vite |
| Routing | React Router v6 |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| UI | Existing design tokens from legacy client where useful; otherwise Tailwind or CSS modules |
| API client | OpenAPI-generated types + fetch wrapper with credentials |

### 3.2 Application shells

Three **portals** share components but differ in navigation and RBAC-gated routes:

| Shell | Primary roles | Entry routes |
|---|---|---|
| Employee Portal | `requester` | `/`, `/incidents/new`, `/my-tickets`, `/tickets/:id` |
| Agent Console | `agent`, `manager` | `/queue`, `/tickets/:id`, `/dashboard` |
| Change & Admin | `change_manager`, `cab_member`, `admin` | `/changes`, `/calendar`, `/approvals`, `/admin/*` |

Single SPA with role-based route guards — not separate deployables.

### 3.3 State management rules

| State type | Where |
|---|---|
| Server data (tickets, lists) | TanStack Query cache |
| Auth session | Context + `/api/v1/auth/me` |
| UI ephemeral (modals, filters) | Local component state |
| Form drafts | React Hook Form |
| **Avoid** | Global Redux for Gen-1 |

### 3.4 Key UX contracts

| Screen | Data dependencies | Notes |
|---|---|---|
| Agent queue | `GET /work-items?type=incident&scope=group&sort=resolution_deadline` | SLA sort default |
| Ticket detail | work item + extension + comments + activity + SLA clocks | Poll SLA every 60s or SSE Phase 2 |
| Change calendar | `GET /changes?scheduled_start=...` | Month/week list views |
| Approval inbox | `GET /approvals?status=pending&assignee=me` | CAB members only |
| Dashboard | 3 widgets — separate lightweight endpoints | No materialized views Gen-1 |

### 3.5 Accessibility & i18n

- WCAG 2.1 AA for core flows (login, create ticket, queue)
- Keyboard navigation on queue and detail actions
- **English-only** Gen-1; strings in `locales/en.json` for Phase 2 i18n

### 3.6 Legacy client migration

Rebuild against new OpenAPI rather than incremental patch of `client/`. Reuse UX patterns from `TicketDetail.jsx`, `Dashboard.jsx` as wireframe reference only.

---

## 4. FastAPI Module Layout

### 4.1 Top-level `app/` structure

```
app/
├── main.py                      # FastAPI factory, lifespan, router mount
├── core/
│   ├── config.py                # Settings from env (Pydantic BaseSettings)
│   ├── database.py              # Engine, session factory, get_db
│   ├── security.py              # JWT encode/decode, password hash
│   ├── permissions.py           # RBAC matrix, require_role deps
│   ├── logging.py
│   ├── exceptions.py              # AppError → HTTP mapping
│   └── middleware.py              # request_id, timing, CORS
│
├── domain/
│   ├── enums.py                 # WorkItemType, Status, Priority, Role
│   ├── workflows/
│   │   ├── incident.py          # INCIDENT_TRANSITIONS dict
│   │   └── change.py            # CHANGE_TRANSITIONS dict
│   └── constants.py             # Category lists, template IDs
│
├── models/                      # SQLAlchemy — one file per aggregate
│   ├── identity.py              # User, Group, UserGroup
│   ├── work_item.py
│   ├── incident.py
│   ├── change.py
│   ├── comment.py
│   ├── attachment.py
│   ├── approval.py
│   ├── sla.py
│   ├── email.py
│   ├── notification.py
│   └── audit.py
│
├── schemas/                     # Pydantic v2 — mirror API contracts
│   ├── auth.py
│   ├── work_item.py
│   ├── incident.py
│   ├── change.py
│   ├── comment.py
│   ├── approval.py
│   ├── sla.py
│   ├── email.py
│   ├── notification.py
│   ├── audit.py
│   └── common.py                # Pagination, ProblemDetail
│
├── services/
│   ├── auth_service.py
│   ├── user_service.py
│   ├── group_service.py
│   ├── work_item_service.py
│   ├── incident_service.py
│   ├── change_service.py
│   ├── workflow_service.py      # transition validation + apply
│   ├── comment_service.py
│   ├── attachment_service.py
│   ├── approval_service.py
│   ├── sla_service.py
│   ├── notification_service.py
│   ├── audit_service.py
│   ├── search_service.py
│   ├── dashboard_service.py
│   └── email/
│       ├── graph_client.py
│       ├── graph_ingest_service.py
│       ├── graph_send_service.py
│       └── email_thread_matcher.py
│
├── api/
│   └── v1/
│       ├── router.py            # Aggregates all v1 routers
│       ├── auth.py
│       ├── users.py
│       ├── groups.py
│       ├── work_items.py
│       ├── incidents.py
│       ├── changes.py
│       ├── transitions.py
│       ├── comments.py
│       ├── attachments.py
│       ├── approvals.py
│       ├── sla.py
│       ├── notifications.py
│       ├── audit.py
│       ├── search.py
│       ├── dashboard.py
│       ├── email_webhook.py     # Graph validation + notify
│       └── admin/
│           ├── users.py
│           ├── groups.py
│           ├── sla_config.py
│           └── graph_config.py
│
└── workers/
    ├── celery_app.py
    ├── tasks_email.py
    ├── tasks_sla.py
    └── tasks_graph.py           # subscription renewal
```

### 4.2 Router ownership (Gen-1 feature map)

| Router | Features | Epic |
|---|---|---|
| `auth` | F-01 | E-01 |
| `users`, `groups` | F-03, F-04 | E-01 |
| `work_items` | F-05, F-06 | E-02 |
| `incidents` | F-09–F-12 | E-03 |
| `transitions` | F-13, F-16 | E-05 |
| `comments` | F-07, F-08 | E-02 |
| `attachments` | F-32 | E-10 |
| `changes` | F-14–F-15, F-18 | E-04 |
| `approvals` | F-17 | E-07 |
| `sla` | F-19–F-21 | E-06 |
| `email_webhook` | F-22–F-27 | E-09 |
| `notifications` | F-29 | E-08 |
| `audit` | F-30, F-31 | E-11 |
| `search` | F-33 | E-12 |
| `dashboard` | F-34 | E-13 |

### 4.3 Dependency injection pattern

| Dependency | Provides |
|---|---|
| `get_db` | SQLAlchemy session (request-scoped) |
| `get_current_user` | Authenticated `User` or 401 |
| `require_roles(...)` | 403 if role missing |
| `get_work_item_or_404` | Loaded entity + scope check |

Services are instantiated per-request or as module singletons with session passed per call — **no** global DB session.

### 4.4 Workflow module (code-defined)

`workflow_service.py` imports transition maps from `domain/workflows/`. Each transition specifies:

- `from_status` (or `*`)
- `to_status`
- `action` name (e.g. `assign`, `resolve`, `submit_for_approval`)
- `allowed_roles`
- Optional `guard` callable (e.g. change must have plans before submit)
- `side_effects` list (sla_pause, notify_requester, create_approval)

**No** `workflow_definitions` table in Gen-1.

---

## 5. React Module Layout

### 5.1 `frontend/src/` structure

```
src/
├── main.tsx
├── App.tsx                      # Router root
├── api/
│   ├── client.ts                # fetch wrapper, credentials, error parse
│   ├── generated/               # openapi-typescript output
│   └── hooks/                   # TanStack Query hooks per resource
│       ├── useAuth.ts
│       ├── useWorkItems.ts
│       ├── useIncidents.ts
│       ├── useChanges.ts
│       ├── useComments.ts
│       ├── useApprovals.ts
│       ├── useNotifications.ts
│       └── useDashboard.ts
│
├── auth/
│   ├── AuthContext.tsx
│   ├── LoginPage.tsx
│   └── ProtectedRoute.tsx
│
├── layouts/
│   ├── EmployeeLayout.tsx
│   ├── AgentLayout.tsx
│   └── AdminLayout.tsx
│
├── features/
│   ├── incidents/
│   │   ├── CreateIncidentPage.tsx
│   │   ├── MyTicketsPage.tsx
│   │   ├── AgentQueuePage.tsx
│   │   ├── IncidentDetailPage.tsx
│   │   ├── components/
│   │   │   ├── IncidentForm.tsx
│   │   │   ├── PriorityMatrixFields.tsx
│   │   │   ├── TransitionActions.tsx
│   │   │   ├── SlaClock.tsx
│   │   │   └── ActivityFeed.tsx
│   │   └── types.ts
│   │
│   ├── changes/
│   │   ├── ChangeListPage.tsx
│   │   ├── ChangeDetailPage.tsx
│   │   ├── ChangeCalendarPage.tsx
│   │   ├── CreateChangePage.tsx
│   │   └── components/
│   │       ├── RiskAssessmentForm.tsx
│   │       ├── PlanFields.tsx
│   │       └── ApprovalStatus.tsx
│   │
│   ├── approvals/
│   │   ├── ApprovalInboxPage.tsx
│   │   └── ApprovalDecisionModal.tsx
│   │
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   └── widgets/
│   │       ├── OpenByStatusChart.tsx
│   │       ├── SlaBreachSummary.tsx
│   │       └── TeamWorkloadTable.tsx
│   │
│   ├── admin/
│   │   ├── UsersAdminPage.tsx
│   │   ├── GroupsAdminPage.tsx
│   │   ├── SlaConfigPage.tsx
│   │   ├── GraphConfigPage.tsx
│   │   └── AuditLogPage.tsx
│   │
│   └── shared/
│       ├── CommentThread.tsx
│       ├── AttachmentUpload.tsx
│       ├── UserPicker.tsx
│       ├── GroupPicker.tsx
│       ├── StatusBadge.tsx
│       ├── NotificationBell.tsx
│       └── SearchBar.tsx
│
├── hooks/
│   ├── useDebounce.ts
│   └── useRole.ts
│
├── utils/
│   ├── dates.ts
│   ├── displayId.ts
│   └── permissions.ts
│
└── styles/
    └── globals.css
```

### 5.2 Route map

| Path | Page | Roles |
|---|---|---|
| `/login` | LoginPage | public |
| `/` | Employee home / redirect by role | authenticated |
| `/incidents/new` | CreateIncidentPage | requester+ |
| `/my-tickets` | MyTicketsPage | requester+ |
| `/queue` | AgentQueuePage | agent, manager |
| `/tickets/:displayId` | IncidentDetailPage | scoped |
| `/changes` | ChangeListPage | change_manager, agent, manager |
| `/changes/new` | CreateChangePage | change_manager |
| `/changes/:displayId` | ChangeDetailPage | scoped |
| `/calendar` | ChangeCalendarPage | change_manager, cab_member |
| `/approvals` | ApprovalInboxPage | cab_member, change_manager |
| `/dashboard` | DashboardPage | agent, manager |
| `/admin/users` | UsersAdminPage | admin |
| `/admin/groups` | GroupsAdminPage | admin |
| `/admin/sla` | SlaConfigPage | admin |
| `/admin/email` | GraphConfigPage | admin |
| `/admin/audit` | AuditLogPage | admin, manager |

### 5.3 Component design rules

- **Container/presentational split** only where data loading is non-trivial
- **Feature colocation** — incident-only components stay under `features/incidents`
- **Shared** only after second consumer exists
- OpenAPI types are source of truth for DTO shapes; Zod schemas for form validation aligned manually

---

## 6. Database Migration Strategy

### 6.1 Tooling

| Tool | Purpose |
|---|---|
| Alembic | Schema versioning, upgrade/downgrade scripts |
| SQLAlchemy 2 | ORM models as migration source of truth |
| PostgreSQL schemas | Namespace bounded contexts |

### 6.2 Schema namespaces (Gen-1)

| Schema | Tables |
|---|---|
| `identity` | `users`, `groups`, `user_groups`, `refresh_tokens` |
| `work_item` | `work_items`, `display_id_sequences`, `comments`, `attachments` |
| `incident` | `incident_extensions` |
| `change` | `change_extensions`, `approvals` |
| `sla` | `business_calendars`, `holidays`, `sla_policies`, `sla_clocks` |
| `email` | `email_messages`, `email_quarantine`, `graph_subscriptions` |
| `notification` | `notifications` |
| `audit` | `audit_logs` |

**Excluded from Gen-1**: `platform.idempotency_keys`, `platform.outbox_events`, `workflow_definitions`, `feature_flags`.

### 6.3 Migration sequencing

Migrations are **linear** and numbered with descriptive slugs:

| Order | Migration | Unlocks |
|---|---|---|
| M001 | `identity_baseline` | Auth sprint |
| M002 | `audit_baseline` | Audit on mutations |
| M003 | `work_item_core` | Work item CRUD |
| M004 | `incident_extension` | Incident module |
| M005 | `comments_attachments` | Collaboration |
| M006 | `sla_baseline` | SLA engine |
| M007 | `change_approval` | Change + CAB |
| M008 | `email_graph` | Email integration |
| M009 | `notifications` | In-app + templates |
| M010 | `indexes_search` | Queue + search performance |

**Rule**: Never edit applied migrations; always add forward migration.

### 6.4 `work_items` core fields (Gen-1)

Aligned with architecture v2 §6.1, minus deferred columns:

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `display_id` | Unique, `INC-YYYYMMDD-####` / `CHG-...` |
| `work_item_type` | `incident` \| `change` |
| `title`, `description` | Text |
| `status` | String enum per type |
| `priority`, `urgency`, `impact` | Incident priority matrix |
| `reported_by_id`, `assigned_to_id`, `assigned_group_id` | FKs |
| `source` | `portal` \| `email` \| `agent` |
| `resolution_deadline` | Denormalized for queue sort |
| `first_response_at`, `resolved_at`, `closed_at` | SLA milestones |
| `soft_deleted_at` | Nullable |
| `created_at`, `updated_at` | UTC |

**Deferred**: `lock_version` (use `updated_at` optimistic check optional in service layer).

### 6.5 Index strategy

| Index | Purpose |
|---|---|
| `(assigned_group_id, status, resolution_deadline)` | Agent queue |
| `(work_item_type, status)` | Dashboard aggregates |
| `(reported_by_id, created_at DESC)` | My tickets |
| `display_id` UNIQUE | Lookup + email ref |
| `email_messages.message_id` UNIQUE | Dedup (F-26) |
| `audit_logs (entity_type, entity_id, created_at)` | Ticket history |

### 6.6 Data migration from legacy

| Source | Gen-1 approach |
|---|---|
| Users | CSV/AD export → `scripts/import_users.py` (F-38) |
| Groups | Manual seed + import |
| Open tickets | **Optional** Phase 1.5 — not required for email cutover |
| CMDB | **Not ported** Gen-1 |
| Email config | New Graph subscription; parallel run |

### 6.7 Migration environments

| Environment | Policy |
|---|---|
| Local dev | `alembic upgrade head` on compose up |
| CI | Ephemeral PG; upgrade + downgrade smoke |
| Staging | Manual approval; backup before upgrade |
| Production | Maintenance window; backup + `upgrade head`; rollback = restore backup (no destructive downgrade) |

### 6.8 Seed data

`scripts/seed_dev.py` provides: admin user, sample groups (L1 Support, CAB), SLA policy, business calendar, category list.

---

## 7. API Design Standards

### 7.1 Versioning and base path

- All endpoints: `/api/v1/...`
- OpenAPI 3.1 at `/api/v1/openapi.json`
- Swagger UI at `/api/v1/docs` (disabled in production or auth-gated)

### 7.2 Resource modeling

| Resource | ID in URL | Notes |
|---|---|---|
| Work items | `{work_item_id}` (UUID) | Internal APIs |
| Human-facing lookup | `?display_id=INC-20260623-0001` | Search, email |
| Nested comments | `/work-items/{id}/comments` | |
| Transitions | `POST /work-items/{id}/transitions` | Body: `{ "action": "resolve", "comment": "..." }` |

### 7.3 HTTP method conventions

| Method | Use |
|---|---|
| GET | Read; list with pagination |
| POST | Create; actions (transition, approve) |
| PATCH | Partial update |
| DELETE | Soft-delete only Gen-1 |

### 7.4 Pagination

- **Cursor/keyset** for agent queue: `?cursor={iso_timestamp,id}&limit=50`
- Response: `{ "items": [], "next_cursor": "..." }`
- Default sort: `resolution_deadline ASC NULLS LAST`

### 7.5 Error format (RFC 7807)

```json
{
  "type": "https://esmp.local/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Requester cannot view this work item",
  "instance": "/api/v1/work-items/uuid"
}
```

| Status | When |
|---|---|
| 400 | Malformed request |
| 401 | Unauthenticated |
| 403 | RBAC / scope denial |
| 404 | Not found or not visible (no enumeration) |
| 422 | Validation / invalid transition |
| 429 | Rate limit |
| 500 | Unexpected (no stack trace to client) |

**Deferred Gen-1**: 409 `lock_version` conflict.

### 7.6 Authentication contract

| Endpoint | Behavior |
|---|---|
| `POST /auth/login` | Sets HttpOnly cookies |
| `POST /auth/refresh` | Rotates refresh token |
| `POST /auth/logout` | Clears cookies |
| `GET /auth/me` | Current user + roles + groups |

### 7.7 RBAC enforcement

Every mutating endpoint documents required role in OpenAPI `description`. `permissions.py` holds matrix:

| Role | Scope |
|---|---|
| `requester` | Own tickets; public comments on own |
| `agent` | Group-assigned tickets; internal comments |
| `manager` | All group tickets; dashboard; reassign |
| `change_manager` | Changes CRUD; submit for approval |
| `cab_member` | Approval decisions on assigned approvals |
| `admin` | User/group/SLA/Graph config; audit read |

Gen-1 uses **5–6 roles** as above (`manager` may merge `service_desk_manager` + `team_lead` from PRD).

### 7.8 Filtering and search

`GET /work-items` query params:

- `work_item_type`, `status`, `assigned_group_id`, `assigned_to_id`
- `reported_by_id`, `source`
- `q` — searches `display_id`, `title`, reporter email (ILIKE)
- `sla_breached=true`

### 7.9 Webhook endpoints

| Endpoint | Auth | Notes |
|---|---|---|
| `GET/POST /api/v1/email/webhook` | Graph validation token | Must respond < 5s |
| `POST /api/v1/email/webhook` | Client state secret | Enqueue only; no heavy work in handler |

### 7.10 OpenAPI workflow

1. Implement router + Pydantic schemas
2. CI validates OpenAPI diff on PR
3. Frontend regenerates types on API change
4. **Freeze** OpenAPI at sprint boundary before FE parallel work

### 7.11 Idempotency (Gen-1 scope)

- **API Idempotency-Key header**: **not** implemented Gen-1
- **Email dedup**: `email_messages.message_id` UNIQUE constraint — mandatory

---

## 8. Event Design

### 8.1 Gen-1 philosophy: domain signals, not event bus

Gen-1 uses **in-process domain signals** (Python function calls), not a persisted event bus. This matches PRODUCTION_MVP_REVIEW §5.3.

```
Service mutation
    ├── audit_service.log(...)
    ├── sla_service.on_status_change(...)
    └── notification_service.dispatch(event_type, payload)
            ├── write notifications row (sync)
            └── celery: send_graph_email.delay(...) (async after commit)
```

### 8.2 Domain event catalog (Gen-1)

| Event type | Emitter | Subscribers (sync) | Async follow-up |
|---|---|---|---|
| `work_item.created` | WorkItemService | Audit, SLA (start clocks), Notification | Email to assignee if assigned |
| `work_item.assigned` | WorkItemService | Audit, Notification | Email |
| `work_item.status_changed` | WorkflowService | Audit, SLA (pause/resume/breach check), Notification | — |
| `work_item.resolved` | WorkflowService | Audit, SLA (stop resolution), Notification | Email to requester |
| `comment.added` | CommentService | Audit, SLA (first response if human agent), Notification | Email if public |
| `approval.requested` | ApprovalService | Audit, Notification | Email to CAB |
| `approval.decided` | ApprovalService | Audit, Workflow (may transition change), Notification | Email |
| `sla.breached` | SLA worker | Audit, Notification | Email to assignee + manager |
| `email.received` | GraphIngestService | Audit, WorkItem/Comment | Auto-ack Celery task |
| `email.quarantined` | GraphIngestService | Audit | Log only Gen-1 (no quarantine UI) |

### 8.3 Event payload shape (internal)

```text
DomainEvent:
  event_type: str
  entity_type: str          # work_item | comment | approval
  entity_id: UUID
  actor_id: UUID | None     # None for system/email
  occurred_at: datetime
  metadata: dict            # small, JSON-serializable
```

No persisted event store Gen-1. Audit log is the historical record.

### 8.4 Notification template mapping

| Event | Template ID | Channels |
|---|---|---|
| `work_item.created` | `TPL_TICKET_CREATED` | in-app, email (requester) |
| `work_item.assigned` | `TPL_ASSIGNED` | in-app, email (assignee) |
| `comment.added` (public) | `TPL_COMMENT` | in-app, email (counterparty) |
| `work_item.resolved` | `TPL_RESOLVED` | in-app, email |
| `approval.requested` | `TPL_APPROVAL_REQ` | in-app, email |
| `approval.decided` | `TPL_APPROVAL_DEC` | in-app, email |
| `sla.breached` | `TPL_SLA_BREACH` | in-app, email |

Six hardcoded templates in `notification_service.py` — no admin template editor.

### 8.5 Phase 2 evolution path

When outbox is introduced:

1. Replace `notification_service.dispatch` internals with `outbox.publish`
2. Celery consumer reads `platform.outbox_events` with idempotency keys
3. Domain event catalog remains stable — only transport changes

---

## 9. Service Layer Design

### 9.1 Service catalog

| Service | Responsibility | Key methods |
|---|---|---|
| `AuthService` | Login, refresh, lockout | `authenticate`, `issue_tokens` |
| `UserService` | User CRUD | `create_user`, `deactivate` |
| `GroupService` | Groups + membership | `add_member`, `list_by_user` |
| `WorkItemService` | Core CRUD, display ID | `create`, `update`, `get_scoped`, `list` |
| `IncidentService` | Incident extension | `create_incident`, `apply_priority_matrix` |
| `ChangeService` | Change extension | `create_change`, `update_plans` |
| `WorkflowService` | Transitions | `execute_transition`, `get_available_actions` |
| `CommentService` | Public/internal comments | `add_comment`, `list_for_work_item` |
| `AttachmentService` | File metadata + storage | `upload`, `download`, `delete` |
| `ApprovalService` | CAB parallel approval | `request_approval`, `decide` |
| `SlaService` | Clocks, pause, breach | `start_clocks`, `on_first_response`, `check_breaches` |
| `NotificationService` | Template render + dispatch | `dispatch`, `list_for_user` |
| `AuditService` | Immutable audit | `log`, `query` |
| `SearchService` | ILIKE search | `search_work_items` |
| `DashboardService` | 3 widgets | `open_by_status`, `sla_summary`, `workload` |
| `GraphIngestService` | Email → ticket/comment | `process_message`, `match_thread` |
| `GraphSendService` | sendMail | `send_auto_ack`, `send_notification` |

### 9.2 Transaction boundaries

| Operation | Transaction scope |
|---|---|
| Create incident | `work_items` + `incident_extensions` + audit + SLA clocks |
| Transition | status update + audit + SLA + notification record |
| Email create | `work_items` + `email_messages` + audit (+ enqueue ack) |
| Approve change | `approvals` + maybe `work_items.status` + audit + notify |

**Rule**: One service method = one `async with session.begin()` (or sync equivalent). Nested service calls accept `session` parameter to join outer transaction.

### 9.3 WorkflowService detail

```
execute_transition(work_item_id, action, actor, payload):
  1. Load work_item + extension
  2. Resolve transition from domain/workflows/{type}.py
  3. Validate role + current status + guards
  4. Apply status change + timestamps (resolved_at, etc.)
  5. audit_service.log(...)
  6. sla_service.on_status_change(...)
  7. notification_service.dispatch('work_item.status_changed', ...)
  8. If action triggers approval → approval_service.request_approval(...)
  9. Return updated DTO
```

### 9.4 Incident priority matrix

Port from `priorityMatrix.js`:

- Input: `urgency` × `impact` → `priority` (P1–P4)
- Manager override allowed with audit reason
- SLA policy matched by `priority` + `work_item_type=incident`

### 9.5 Incident workflow (Gen-1)

| Status | Notes |
|---|---|
| `new` | Initial |
| `assigned` | Has assignee/group |
| `in_progress` | Agent working |
| `pending_user` | Pauses resolution SLA |
| `resolved` | Resolution code set |
| `closed` | Terminal |
| `cancelled` | Terminal |

Actions: `assign`, `start_work`, `pending_user`, `resume`, `resolve`, `close`, `reopen`, `cancel`.

### 9.6 Change workflow (Gen-1)

Simplified from PRD — no collision detection:

| Status | Notes |
|---|---|
| `draft` | Editing plans |
| `submitted` | Awaiting risk review |
| `pending_approval` | CAB queue |
| `approved` | Ready to schedule |
| `scheduled` | On calendar |
| `implementing` | In progress |
| `completed` | Validation done |
| `closed` | Terminal |
| `rejected` | Returned to draft |

**Expedited flag**: Skips to `pending_approval` with `expedited=true` audit marker.

CAB: **parallel, any-one-approves** (F-17).

### 9.7 Email ingest service

Processing pipeline (normative per PRD §23.4):

1. Dedup `Message-ID`
2. Skip auto-replies / OOO / delivery failures
3. Extract ticket ref regex: `(INC|CHG)-\d{8}-\d{4}`
4. Fallback: `In-Reply-To` / `References` → `email_messages`
5. No ref → `IncidentService.create_incident(source=email)`
6. Ref + authorized sender → `CommentService.add_comment(visibility=public)`
7. Ref + unauthorized → `email_quarantine` row (log; no UI Gen-1)
8. Enqueue auto-ack (new tickets only)

**First response SLA**: auto-ack does **not** set `first_response_at` (BR-INC-004).

### 9.8 Authorization in services

Scope checks live in services, not only routers:

- `WorkItemService.get_scoped(user, id)` raises `Forbidden` if requester accesses other's ticket
- `CommentService` enforces internal comment visibility
- `GraphIngestService` validates sender against requester + group membership

### 9.9 Service testing seam

Services accept optional clock and Graph client interfaces for unit tests (dependency injection via constructor or function params).

---

## 10. Background Job Design

### 10.1 Celery topology (Gen-1)

| Component | Role |
|---|---|
| Redis | Broker + result backend (results expire 1h) |
| `celery worker` | Executes tasks |
| `celery beat` | Schedules periodic tasks |

**No** Redis Streams. **No** outbox consumer.

### 10.2 Task catalog

| Task | Queue | Trigger | Timeout | Retries |
|---|---|---|---|---|
| `process_graph_notification` | `email` | Webhook POST | 120s | 3 exp backoff |
| `fetch_and_process_message` | `email` | Called by above | 120s | 3 |
| `send_graph_email` | `email` | Notification service | 60s | 5 |
| `send_auto_ack` | `email` | After ticket create | 60s | 5 |
| `renew_graph_subscription` | `graph` | Beat daily | 60s | 3 |
| `delta_poll_mailbox` | `email` | Beat every 60s (if webhook unhealthy) | 300s | 2 |
| `sla_breach_scan` | `sla` | Beat every 1 min | 120s | 1 |
| `sla_reconcile_deadlines` | `sla` | Beat every 5 min | 120s | 1 |

### 10.3 Beat schedule

| Schedule | Task |
|---|---|
| `*/1 * * * *` | `sla_breach_scan` |
| `*/5 * * * *` | `sla_reconcile_deadlines` |
| `*/1 * * * *` | `delta_poll_mailbox` (conditional — skip if webhook healthy) |
| `0 2 * * *` | `renew_graph_subscription` |

### 10.4 Email processing flow

```
Graph webhook → API returns 200 immediately
             → process_graph_notification.delay(notification_payload)
                  → fetch full message from Graph
                  → GraphIngestService.process_message()
                  → on new ticket: send_auto_ack.delay(work_item_id)
```

### 10.5 SLA breach scan

```
sla_breach_scan:
  FOR each active incident with running clocks:
    IF now > deadline AND NOT breached:
      SET breached=true
      audit + notification_service.dispatch('sla.breached')
```

At-risk count on dashboard: `deadline - now < 20% of total allowed time` (simple Gen-1 heuristic).

### 10.6 Failure handling

| Failure | Behavior |
|---|---|
| Graph 429 | Retry with backoff |
| Graph 5xx | Retry; alert after exhaustion |
| Duplicate Message-ID | IntegrityError → log info, no retry |
| Poison message | Dead letter log table `email_processing_errors`; manual replay script |

### 10.7 Observability

- Celery task logs include `task_id`, `work_item_id`, `message_id`
- Prometheus metrics (Phase 1.5): task duration, queue depth, failure count
- Alert: email queue lag > 5 min

### 10.8 What is NOT a background job Gen-1

- Audit writes (sync)
- In-app notification row creation (sync)
- Workflow transitions (sync)
- Approval decisions (sync)

---

## 11. Testing Strategy

### 11.1 Test pyramid

| Layer | Target % effort | Tools |
|---|---|---|
| Unit | 50% | pytest, pytest-asyncio, freezegun |
| Integration | 35% | pytest + Testcontainers PostgreSQL + Redis |
| E2E | 15% | Playwright |
| Contract | Ongoing | schemathesis or openapi diff |

**Coverage goal**: 80% on `services/` and `domain/workflows/`; 60% overall Gen-1.

### 11.2 Unit tests (priority modules)

| Module | Cases |
|---|---|
| `workflow_service` | Every transition valid/invalid; role denial |
| `priority_service` | Matrix combinations + override |
| `email_thread_matcher` | Ref regex, In-Reply-To, unauthorized |
| `sla_service` | Business hours, pause on pending_user, breach |
| `approval_service` | Parallel any-approve; reject → draft |
| `permissions` | Requester scope, agent group scope |

### 11.3 Integration tests

| Suite | Scope |
|---|---|
| `test_auth_flow` | Login, refresh, lockout |
| `test_work_item_crud` | Create incident + audit row |
| `test_incident_lifecycle` | Full happy path to closed |
| `test_email_dedup` | Same Message-ID twice |
| `test_email_reply` | Comment on existing INC |
| `test_change_cab` | Submit → approve → scheduled |
| `test_sla_breach` | Fast-forward clock → breach flag |

Use **Graph client mock** fixture; one smoke test against Graph sandbox if credentials available.

### 11.4 E2E tests (Playwright)

| Flow | AC reference |
|---|---|
| Employee creates incident | F-09 |
| Agent assigns and resolves | F-12, F-13 |
| Email webhook simulation → ticket in queue | AC-EMAIL-MVP-01 |
| Reply adds comment not duplicate | AC-EMAIL-MVP-03 |
| CAB approves change | F-17 |
| Dashboard shows breach count | F-34 |

Run E2E on staging nightly; PR smoke subset (login + create ticket).

### 11.5 Test data

- Factory fixtures: `UserFactory`, `IncidentFactory`
- `seed_dev.py` for local manual QA
- No production data in tests; synthetic emails only

### 11.6 Non-functional tests

| NFR | Method |
|---|---|
| API p95 < 500ms list/detail | k6 load test on staging (100 VUs) |
| Webhook < 5s validation | Unit timing test |
| Security | OWASP ZAP baseline on staging (pre-go-live) |

### 11.7 QA process alignment

| Gate | Criteria |
|---|---|
| Story DoD | Unit tests + OpenAPI updated + RBAC test |
| Sprint end | Integration suite green |
| Release | E2E green + parallel-run checklist (F-38) |

---

## 12. CI/CD Strategy

### 12.1 Branch model

| Branch | Purpose |
|---|---|
| `main` | Production-ready; tagged releases |
| `develop` | Integration branch |
| `feature/*` | Story work |
| `release/*` | Hardening sprints |

PRs → `develop`; release PR → `main`.

### 12.2 CI pipeline (on PR)

```text
lint (ruff, mypy backend; eslint, tsc frontend)
    → unit tests (backend)
    → unit tests (frontend)
    → integration tests (Testcontainers)
    → OpenAPI diff check
    → build Docker images
    → Playwright smoke (optional on develop)
```

### 12.3 CD pipeline (on `main` tag)

```text
build & push images (api, worker, beat, web)
    → deploy to staging (auto)
    → smoke tests
    → manual approval
    → deploy to production
    → post-deploy: alembic upgrade head
    → health check /api/v1/health
```

### 12.4 GitHub Actions layout

```
.github/workflows/
├── ci-backend.yml
├── ci-frontend.yml
├── ci-e2e.yml
├── deploy-staging.yml
└── deploy-production.yml
```

### 12.5 Database migrations in CD

- Migrations run as **init container** or **pre-deploy job** before new API version serves traffic
- Backward-compatible migrations only (expand — contract pattern)
- No destructive DDL in single release

### 12.6 Rollback

| Layer | Strategy |
|---|---|
| Application | Redeploy previous image tag |
| Database | Restore from pre-migration backup (no `downgrade` in prod) |
| Graph subscription | Previous credentials remain valid |

### 12.7 Artifact registry

Container images tagged: `esmp-api:{git_sha}`, `esmp-web:{git_sha}`.

---

## 13. Environment Strategy

### 13.1 Environment matrix

| Env | Purpose | Data | Graph | URL |
|---|---|---|---|---|
| **local** | Developer | Docker PG seed | Mock / optional ngrok + dev mailbox | `localhost:5173` / `:8000` |
| **dev** | Shared integration | Synthetic | Dev app registration | `dev.esmp.corp.internal` |
| **staging** | Pre-prod validation | Anonymized copy | Staging mailbox | `staging.esmp.corp.internal` |
| **production** | Live | Real | Production shared mailbox | `itsm.corp.internal` |

### 13.2 Configuration management

| Source | Contents |
|---|---|
| `.env.example` | Documented keys, no secrets |
| Env vars / vault | Secrets, Graph credentials |
| `config.py` | Typed settings with validation |

### 13.3 Required environment variables

| Variable | Description |
|---|---|
| `ESMP_DATABASE_URL` | PostgreSQL connection |
| `ESMP_REDIS_URL` | Celery broker |
| `ESMP_SECRET_KEY` | JWT signing |
| `ESMP_GRAPH_TENANT_ID` | Azure AD tenant |
| `ESMP_GRAPH_CLIENT_ID` | App registration |
| `ESMP_GRAPH_CLIENT_SECRET` | App secret |
| `ESMP_GRAPH_MAILBOX` | Shared mailbox UPN |
| `ESMP_GRAPH_WEBHOOK_URL` | Public HTTPS webhook |
| `ESMP_GRAPH_WEBHOOK_SECRET` | Client state validation |
| `ESMP_ATTACHMENT_PATH` | Local path or MinIO endpoint |
| `ESMP_ORG_TIMEZONE` | e.g. `Asia/Kolkata` |
| `ESMP_CORS_ORIGINS` | Frontend origin |
| `ESMP_ENV` | `local` \| `dev` \| `staging` \| `production` |

### 13.4 Local development (docker-compose)

Services: `postgres`, `redis`, `api`, `worker`, `beat`, `web` (Vite dev or nginx static).

Optional: `mailhog` **not used** — Graph mock instead.

IMAP fallback for dev only via feature flag `ESMP_EMAIL_TRANSPORT=imap` referencing legacy logic — **not** for staging/prod.

### 13.5 Production topology (Gen-1)

```
                    ┌─────────────┐
   Users ──────────►│   Nginx     │ TLS termination
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      ┌─────────┐    ┌──────────┐   ┌──────────┐
      │  React  │    │ FastAPI  │   │ FastAPI  │ (optional 2nd instance)
      │  static │    │   API    │   │   API    │
      └─────────┘    └────┬─────┘   └────┬─────┘
                          │              │
                    ┌─────▼──────────────▼─────┐
                    │      PostgreSQL          │
                    └──────────────────────────┘
                    ┌──────────────────────────┐
                    │  Redis + Celery worker   │
                    │  + Celery beat           │
                    └──────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │ Microsoft │
                    │   Graph   │
                    └───────────┘
```

Single VM Docker Compose is acceptable Gen-1.

### 13.6 Secrets rotation

| Secret | Cadence |
|---|---|
| Graph client secret | 90 days or per IT policy |
| JWT secret | On compromise; forces re-login |
| DB password | Annual |

### 13.7 Observability per environment

| Signal | Local | Staging/Prod |
|---|---|---|
| Logs | stdout | JSON → file/agent |
| Metrics | optional | Prometheus |
| Dashboards | — | Grafana |
| Alerts | — | Email to ops ( breach queue, Graph renewal failure) |

PII redaction at log boundary per PRD §24.

---

## 14. Sprint Breakdown

### 14.1 Planning assumptions

| Parameter | Value |
|---|---|
| Sprint length | 2 weeks |
| Team velocity (calibrated S3+) | ~20–24 points/sprint |
| Total program | 14 sprints (~7 months) |
| Parallelism | BE/FE split after S2; Graph sprint overlaps UI |

Feature IDs reference PRODUCTION_MVP_REVIEW §7 (F-01–F-38).

### 14.2 Program milestones

| Milestone | Sprint | Exit criteria |
|---|---|---|
| M1 — Foundation | S1–S2 | Login, RBAC, work item schema, audit |
| M2 — Incident core | S3–S4 | Incident CRUD, workflow, comments |
| M3 — Agent UI | S5 | Queue + detail usable by agents |
| M4 — Graph email | S6–S7 | AC-EMAIL-MVP-01–07 |
| M5 — SLA + notify | S8 | Breach detection + templates |
| M6 — Change + CAB | S9–S10 | Change lifecycle + approvals |
| M7 — Dashboard + search | S11 | F-33, F-34 |
| M8 — Hardening + cutover | S12–S14 | F-38, parallel run, go-live |

### 14.3 Sprint backlog

---

#### Sprint 1 (S1) — Identity & audit foundation

**Goal**: Authenticated API with audit on mutations.  
**Points**: ~22

| ID | Story | Pts | Features |
|---|---|---|---|
| S1-01 | Docker-compose + Alembic M001–M002 | 3 | Infra |
| S1-02 | JWT login/logout/refresh (HttpOnly cookies) | 5 | F-01 |
| S1-03 | RBAC middleware — 5 roles | 5 | F-02 |
| S1-04 | AuditService sync write | 3 | F-30 |
| S1-05 | Health + structured logging | 2 | NFR |
| S1-06 | React login page + auth context | 4 | F-35 partial |

**Exit**: User logs in; unauthorized → 403; mutation writes audit row.

---

#### Sprint 2 (S2) — Work item core

**Goal**: Work items exist with display IDs.  
**Points**: ~24

| ID | Story | Pts | Features |
|---|---|---|---|
| S2-01 | M003 work_item schema | 3 | F-05 |
| S2-02 | WorkItem create/get/list (scoped) | 5 | F-05 |
| S2-03 | Display ID generation INC-/CHG- | 3 | F-06 |
| S2-04 | User + group admin API | 5 | F-03, F-04 |
| S2-05 | PATCH work item fields | 3 | F-05 |
| S2-06 | Integration tests: CRUD + audit + RBAC | 3 | — |
| S2-07 | Admin users/groups UI skeleton | 2 | F-35 |

**Exit**: Agent can create work item via API; display_id unique.

---

#### Sprint 3 (S3) — Incident module + workflow

**Goal**: Incident lifecycle via API.  
**Points**: ~24

| ID | Story | Pts | Features |
|---|---|---|---|
| S3-01 | M004 incident_extensions | 2 | F-09 |
| S3-02 | Incident create (portal fields) | 5 | F-09 |
| S3-03 | Priority matrix service | 3 | F-10 |
| S3-04 | Categories (fixed enum) | 2 | F-11 |
| S3-05 | Assignment to user/group | 3 | F-12 |
| S3-06 | WorkflowService — incident transitions | 5 | F-13 |
| S3-07 | Transition API + guards | 4 | F-13 |

**Exit**: Full incident happy path via API; invalid transition → 422.

---

#### Sprint 4 (S4) — Comments, attachments, activity

**Goal**: Collaboration layer.  
**Points**: ~22

| ID | Story | Pts | Features |
|---|---|---|---|
| S4-01 | M005 comments + attachments | 2 | F-07 |
| S4-02 | Public/internal comments + RBAC | 5 | F-07 |
| S4-03 | Activity feed (comments + status changes) | 3 | F-08 |
| S4-04 | Attachment upload/download (25MB) | 5 | F-32 |
| S4-05 | Employee create incident UI | 5 | F-35 |
| S4-06 | My tickets list UI | 2 | F-35 |

**Exit**: Requester creates ticket; adds public comment; agent adds internal note.

---

#### Sprint 5 (S5) — Agent console UI

**Goal**: Agents work tickets in portal.  
**Points**: ~24

| ID | Story | Pts | Features |
|---|---|---|---|
| S5-01 | Agent queue with filters + SLA sort | 8 | F-36 |
| S5-02 | Incident detail — transitions, assign | 8 | F-36 |
| S5-03 | Activity feed UI | 3 | F-36 |
| S5-04 | Attachment UI | 3 | F-36 |
| S5-05 | E2E: create → assign → resolve | 2 | — |

**Exit**: Agent resolves ticket without API tools.

---

#### Sprint 6 (S6) — Graph integration (part 1)

**Goal**: Webhook receives mail; creates incidents.  
**Points**: ~26

| ID | Story | Pts | Features |
|---|---|---|---|
| S6-01 | M008 email schema | 2 | F-22 |
| S6-02 | Graph client (app-only auth) | 3 | F-22 |
| S6-03 | Webhook validation + enqueue | 5 | F-22, AC-EMAIL-MVP-06 |
| S6-04 | Celery email worker setup | 3 | Infra |
| S6-05 | Message fetch + parse | 5 | F-23 |
| S6-06 | Message-ID dedup | 2 | F-26 |
| S6-07 | Email → create incident | 6 | F-23, AC-EMAIL-MVP-01 |

**Exit**: Simulated webhook creates INC within 2 min in dev.

---

#### Sprint 7 (S7) — Graph integration (part 2)

**Goal**: Threading, auto-ack, reliability.  
**Points**: ~24

| ID | Story | Pts | Features |
|---|---|---|---|
| S7-01 | Reply → comment + auth check | 5 | F-24, AC-EMAIL-MVP-03 |
| S7-02 | Quarantine unauthorized (log) | 2 | AC-EMAIL-MVP-05 |
| S7-03 | Auto-ack sendMail | 5 | F-25, AC-EMAIL-MVP-02 |
| S7-04 | Subscription renewal + delta poll | 5 | F-27 |
| S7-05 | Admin Graph config UI | 3 | Admin |
| S7-06 | Integration tests — full email suite | 4 | AC-EMAIL-MVP-* |

**Exit**: AC-EMAIL-MVP-01–07 satisfied in staging.

---

#### Sprint 8 (S8) — SLA + notifications

**Goal**: Accountability visible.  
**Points**: ~24

| ID | Story | Pts | Features |
|---|---|---|---|
| S8-01 | M006 SLA schema + business calendar | 3 | F-20 |
| S8-02 | SLA policy + clock start | 5 | F-19 |
| S8-03 | First response = human action only | 3 | BR-INC-004 |
| S8-04 | Pause on pending_user | 3 | F-19 |
| S8-05 | Breach scan Celery job | 5 | F-21 |
| S8-06 | NotificationService — 6 templates | 5 | F-28, F-29 |

**Exit**: Breach flag set; assignee notified; SLA clock on ticket detail UI.

---

#### Sprint 9 (S9) — Change module

**Goal**: Change records + plans.  
**Points**: ~24

| ID | Story | Pts | Features |
|---|---|---|---|
| S9-01 | M007 change schema | 2 | F-14 |
| S9-02 | Change create + plan fields | 5 | F-14 |
| S9-03 | Risk assessment score | 3 | F-15 |
| S9-04 | Change workflow (code-defined) | 5 | F-16 |
| S9-05 | Change calendar API | 5 | F-18 |
| S9-06 | Create change UI | 4 | F-37 |

**Exit**: Change manager creates normal change with plans.

---

#### Sprint 10 (S10) — CAB approvals

**Goal**: Governance gate before schedule.  
**Points**: ~22

| ID | Story | Pts | Features |
|---|---|---|---|
| S10-01 | ApprovalService parallel any-approve | 5 | F-17 |
| S10-02 | Approval inbox API | 3 | F-17 |
| S10-03 | Reject → return draft + notify | 3 | F-17 |
| S10-04 | Approval inbox UI | 5 | F-37 |
| S10-05 | Change detail + calendar UI | 6 | F-37, F-18 |

**Exit**: Normal change cannot reach scheduled without approval.

---

#### Sprint 11 (S11) — Search, dashboard, audit UI

**Goal**: Visibility for managers.  
**Points**: ~20

| ID | Story | Pts | Features |
|---|---|---|---|
| S11-01 | Search service (ILIKE) | 3 | F-33 |
| S11-02 | Dashboard 3 widgets API | 5 | F-34 |
| S11-03 | Dashboard UI | 5 | F-34 |
| S11-04 | Audit log viewer (admin) | 5 | F-31 |
| S11-05 | SLA config admin UI | 2 | Admin |

**Exit**: Manager sees open count, breaches, workload.

---

#### Sprint 12 (S12) — Hardening

**Goal**: Production NFRs.  
**Points**: ~22

| ID | Story | Pts | Features |
|---|---|---|---|
| S12-01 | Rate limiting + abuse rules | 3 | BR-ABUSE-001 |
| S12-02 | k6 load test fixes | 5 | NFR |
| S12-03 | Security review remediation | 5 | — |
| S12-04 | M010 index optimization | 3 | — |
| S12-05 | Runbook + on-call docs | 3 | — |
| S12-06 | E2E full regression | 3 | — |

---

#### Sprint 13 (S13) — Pilot

**Goal**: 4-week parallel run starts.  
**Points**: ~20

| ID | Story | Pts | Features |
|---|---|---|---|
| S13-01 | User import script + pilot seed | 3 | F-38 |
| S13-02 | Parallel-run playbook doc | 2 | F-38 |
| S13-03 | Pilot bug burn-down | 10 | — |
| S13-04 | Agent training + feedback | 5 | — |

**Exit**: IT desk using portal alongside Outlook.

---

#### Sprint 14 (S14) — Cutover & go-live

**Goal**: Email is system of record.  
**Points**: ~18

| ID | Story | Pts | Features |
|---|---|---|---|
| S14-01 | Production deploy + migration | 5 | — |
| S14-02 | Graph production subscription | 3 | F-22 |
| S14-03 | Email cutover (forwarding verified) | 5 | F-38 |
| S14-04 | Hypercare week | 5 | — |

**Exit**: PRODUCTION_MVP_REVIEW §9.5 checklist complete.

### 14.4 Dependency graph (critical path)

```
S1 Auth → S2 Work Item → S3 Incident → S5 Agent UI
                              ↓
S4 Comments ──────────────────┘
                              ↓
                    S6–S7 Graph Email (critical)
                              ↓
                    S8 SLA → S11 Dashboard
                              ↓
S9 Change → S10 CAB ──────────┘
                              ↓
                    S12–S14 Hardening → Go-live
```

**Graph email (S6–S7)** is on the critical path for business value (G1). Do not defer behind platform plumbing.

### 14.5 Parallel workstreams

| Stream | Sprints | Owner |
|---|---|---|
| Backend platform | S1–S4 | BE-1 |
| Incident + workflow | S3–S5 | BE-2 |
| Graph + Celery | S6–S7 | BE-1 + DevOps |
| SLA + notifications | S8 | BE-2 |
| Change + approval | S9–S10 | BE-1 |
| Employee UI | S4–S5 | FE-1 |
| Agent + change UI | S5, S9–S10 | FE-2 |
| Admin + dashboard | S11 | FE-1 + FE-2 |
| QA E2E | S5+ continuous | QA |

### 14.6 Definition of Done (engineering)

Aligned with PRD §21.1, adapted for Gen-1:

- [ ] Unit tests for service logic
- [ ] Integration test for happy path
- [ ] OpenAPI updated
- [ ] RBAC test proves 403 for unauthorized role
- [ ] Audit row verified on mutation
- [ ] No P0 linter errors
- [ ] Feature flag not required (none in Gen-1)

### 14.7 Velocity risk buffers

| Risk | Buffer |
|---|---|
| Graph IT approval delays | Start S6 webhook with mock; parallel IT ticket |
| Celery operational learning | DevOps owns S6-04 early |
| Scope creep from PRD §14 | PM enforces F-01–F-38 only |
| Change module complexity | Expedited path is flag only, not separate workflow |

---

## Appendix A: Traceability

| Blueprint section | PRD | MVP Review | Architecture v2 |
|---|---|---|---|
| Work Item model | §6, EPIC-002 | §5.2 Option A | §6 Work Item |
| Email | §23 | §3.3, §5.4 | §22 Email |
| SLA | EPIC-004 | §3.6 | §14 SLA |
| RBAC | §19 | §3.1 (5 roles) | §19 RBAC |
| Deferred items | §14 (enterprise) | §3.9, §4 | Outbox §15 |

## Appendix B: Document control

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-06-23 | Initial engineering blueprint from frozen PRD v1.2 + MVP Review v1.0 + Architecture v2 |

**Next review**: After Sprint 2 velocity calibration or Graph POC completion.

---

*End of Engineering Blueprint*
