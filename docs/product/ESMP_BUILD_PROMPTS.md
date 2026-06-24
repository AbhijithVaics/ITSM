# ESMP Build Prompts — ServiceNow-Style ITSM (Incident + Change)

**For**: Internal Outlook / Microsoft 365 email → ticket tracking  
**Stack**: FastAPI · React · PostgreSQL  
**Scope (now)**: Incident Management + Change Management  
**Product requirements**: [ESMP_PRD.md](./ESMP_PRD.md) v1.2 (§0 North Star, §23 Email, §24 Stack)

> Use this document as copy-paste prompts in Cursor or any AI coding agent.  
> Your repo already has a working **IMAP email-to-ticket** prototype (`server/src/services/emailInbound.js`). For corporate **Outlook / M365**, the production path is **Microsoft Graph API** (IMAP is often disabled by IT).

---

## 1. Can you do this? (Short answer: Yes)

| What you want | How ServiceNow / Jira SM do it | Your approach |
|---|---|---|
| Employee emails `it-support@company.com` | Inbound email actions on a mailbox | Graph API reads **shared mailbox** inside your tenant |
| System creates a ticket | Email parser + rules | FastAPI worker creates `INC-…` work item |
| Employee replies by email | Thread detection via ticket ref in subject | Regex + `In-Reply-To` / `References` headers |
| Agent works in portal | UI + workflows | React agent queue |
| Change requests with approval | CAB workflow | Change module + approval engine |
| Internal-only mail (no external SMTP) | Uses org mail server | **Graph `sendMail`** stays inside M365 — no public SMTP needed |

**Important**: You do **not** need to send mail to Gmail/Yahoo. Everything stays in your **Microsoft 365 tenant**. Employees use Outlook; your app uses Graph with an **Azure AD app registration**.

---

## 2. How to track Outlook mails (end-to-end)

```
Employee (Outlook)                    Your ITSM (FastAPI)                    PostgreSQL
      |                                      |                                  |
      |-- email to it-helpdesk@corp -------->|                                  |
      |                                      |-- Graph webhook OR delta poll ---->|
      |                                      |-- parse subject/body ------------>|
      |                                      |-- dedupe Message-ID ------------>| email_messages
      |                                      |-- create INC-20260623-0001 ----->| work_items
      |                                      |-- sync audit log --------------->| audit_logs
      |<-- auto-reply (Graph sendMail) ------|  "Your ticket INC-… created"       |
      |                                      |                                  |
      |-- reply with INC in subject --------->|                                  |
      |                                      |-- match thread, add comment ---->| comments
      |                                      |                                  |
Agent (React portal) ----------------------->| assign, resolve, SLA ------------>|
```

### 2.1 What you need from IT (one-time setup)

| Item | Purpose |
|---|---|
| **Shared mailbox** | e.g. `it-helpdesk@yourcompany.com` — all support mail goes here |
| **Azure AD app registration** | Client ID + secret; permissions: `Mail.Read`, `Mail.ReadWrite` (application) on that mailbox |
| **Admin consent** | IT admin approves Graph permissions |
| **HTTPS URL** | Graph webhooks require a public HTTPS endpoint (`https://itsm.yourcompany.com/api/v1/email/webhook`). Dev: ngrok |
| **Firewall** | App server can reach `graph.microsoft.com` |

### 2.2 How threading works (so replies don’t create duplicate tickets)

1. **New mail, no ticket ref** → create incident, store `message_id` in `email_messages`
2. **Reply mail** → check subject/body for `INC-YYYYMMDD-####` or `CHG-YYYYMMDD-####`
3. **Also check** `In-Reply-To` and `References` headers against stored `message_id` map
4. **Deduplicate** on `Message-ID` (same email processed twice = skip)
5. **Authorize sender** — only requester, watchers, or support group members can update via email; others → quarantine queue for agent review

### 2.3 IMAP vs Graph (your situation)

| Method | When to use |
|---|---|
| **IMAP polling** (you have this today) | Quick prototype; works if IT allows IMAP on the mailbox |
| **Microsoft Graph** (recommended for Outlook) | Corporate M365 standard; real-time webhooks; Microsoft is deprecating basic auth/IMAP on many tenants |

**Recommendation**: Keep IMAP for local dev if it works; build **Graph integration** for production.

### 2.4 “We can’t send mail outside office”

That usually means one of:

- **A)** Mail must stay on corporate Exchange → **Graph API is correct** (all internal).
- **B)** App cannot use external SMTP relay → **Don’t use SendGrid/Mailgun**; use Graph `sendMail` from the shared mailbox.
- **C)** Users only have internal addresses → Fine; map users by `email` in your `users` table.

Auto-acknowledgement example (internal only):

> From: IT Helpdesk <it-helpdesk@company.com>  
> Subject: [INC-20260623-0042] We received your request  
> Body: Your ticket INC-20260623-0042 has been created. Reply to this email to add updates.

---

## 3. Application shape (what you are building)

```
┌─────────────────────────────────────────────────────────────┐
│                     React Portal                             │
│  Employee: Report Issue | My Tickets                         │
│  Agent: Queue | Ticket Detail | Internal Notes               │
│  Change Manager: Changes | Calendar | CAB Approvals          │
│  Admin: Users | Groups | Workflows | Email Config            │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│                     FastAPI                                  │
│  Work Items (generic) │ Incident │ Change │ Comments │ Audit   │
│  Workflow Engine │ SLA Engine │ Approval Engine              │
│  Email Ingestion (Graph) │ Notification (email + in-app)     │
└──────────┬───────────────────────────────┬────────────────────┘
           │                               │
    PostgreSQL                         Redis + Celery
    (tickets, users,                  (async email parse,
     audit, email map)                 SLA timers, notifications)
           │
    Microsoft Graph API  ←── webhook + sendMail (internal M365)
```

**Core pattern (like ServiceNow)**: One **Work Item** table; Incident and Change are extensions with different workflows.

---

## 4. Master prompt (paste this to start the whole application)

```text
You are a senior full-stack architect. Build an internal ITSM platform (ServiceNow / Jira Service Management style) for our organization.

## Business problem
- Employees currently email IT support via Outlook (internal Microsoft 365 only).
- Emails get lost, untracked, no SLA, no audit trail.
- We need a web portal PLUS email-to-ticket so every request becomes a tracked work item.

## Scope (Phase 1–2)
- Incident Management (full lifecycle)
- Change Management (normal + emergency, CAB approval)
- NOT in v1: CMDB, service catalog, AI, mobile app

## Tech stack (mandatory)
- Backend: Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2
- Frontend: React 18+, TypeScript, Vite, React Router
- Database: PostgreSQL 16
- Async jobs: Celery + Redis
- Auth: JWT (HttpOnly cookies), RBAC roles: requester, agent, change_manager, cab_member, admin
- Email: Microsoft Graph API for shared mailbox it-helpdesk@company.com (NOT external SMTP)
- File storage: local/MinIO for attachments

## Architecture rules
1. Generic Work Item model — Incident and Change extend it (same pattern as ServiceNow task table).
2. Configurable workflow engine (state machine in DB, not hardcoded if/else).
3. Every mutation writes an immutable audit log (actor, timestamp, old/new values).
4. Email ingestion: webhook primary, Graph delta poll fallback; dedupe on Message-ID; thread by ticket ref INC-YYYYMMDD-#### and In-Reply-To.
5. Auto-ack email on new ticket via Graph sendMail (does NOT count as agent first response).
6. API-first; OpenAPI documented.

## Roles & main screens
- Employee: create incident, my tickets, comment, attach files
- Agent: queue sorted by SLA deadline, ticket detail, internal notes, assign, resolve
- Change manager: create change, risk fields, schedule, CAB queue
- Admin: users, groups, SLA policies, business calendar, email/Graph config

## Non-functional
- API p95 < 500ms for ticket list/detail
- Optimistic concurrency (lock_version) on updates
- Idempotency-Key on POST/PATCH
- Structured JSON logging; no passwords in logs

## Deliverables for this session
1. Monorepo folder structure (backend + frontend + docker-compose for postgres, redis)
2. Database models: users, groups, work_items, incident_extensions, change_extensions, comments, attachments, audit_logs, email_messages, sla_policies, approvals, workflow_definitions
3. Auth + RBAC middleware
4. Incident CRUD + state machine transitions
5. Graph email webhook skeleton + email-to-ticket service
6. React: login, employee create incident, agent queue, ticket detail

Reference architecture: docs/architecture/ESMP_ARCHITECTURE_v2.md in this repo (use as design baseline; do not over-engineer beyond Phase 1).

Start with docker-compose and Alembic migrations, then vertical slice: email creates incident → appears in agent queue.
```

---

## 5. Phase-wise prompts

### Phase 1 — Foundation + Incident + Email (8–12 weeks)

**Goal**: Replace lost Outlook threads with tracked incidents.

```text
PHASE 1 — ESMP Foundation + Incident + Email Integration

Build on FastAPI + React + PostgreSQL.

### Sprint A: Platform core
- Users, groups, roles, JWT auth, RBAC middleware
- work_items table (id, display_id, work_item_type, title, description, status, priority, urgency, impact, reported_by, assigned_to, assigned_group, source, lock_version, timestamps)
- display_id format: INC-YYYYMMDD-#### (daily sequence)
- Audit log on every create/update/delete
- Alembic migrations, docker-compose (postgres, redis)

### Sprint B: Incident module
- incident_extensions (category, subcategory, resolution_code, is_major_incident)
- Priority matrix: auto-compute from urgency × impact (allow manager override with audit)
- Incident state machine: New → Assigned → In Progress → Pending User → Resolved → Closed (+ Cancelled, Reopened)
- Transition API POST /work-items/{id}/transition with guards
- Comments: public (requester sees) vs internal (agents only)
- Activity timeline API aggregating status changes + comments + audit

### Sprint C: Microsoft Graph email (CRITICAL)
- Azure AD app-only auth (client credentials)
- POST /api/v1/email/webhook — handle validationToken handshake (return plain text within 5s)
- Subscribe to shared mailbox /users/{mailbox}/mailFolders('Inbox')/messages
- Celery task: fetch full message, parse, dedupe Message-ID
- If subject/body matches INC-YYYYMMDD-#### → add public comment (authorized senders only)
- Else → create incident with source=email, reported_by matched by sender email
- Store email_messages (message_id, thread_id, work_item_id, raw headers)
- Auto-ack via Graph sendMail with ticket ref in subject
- Fallback: delta query poll every 60s if webhook down
- Subscription renewal before expiry (~2 days)

### Sprint D: React UI (MVP)
- Login, employee home, create incident form, my tickets list, ticket detail (requester view)
- Agent queue (sort by SLA deadline placeholder), agent ticket detail (transitions, internal notes, assign)
- Basic admin: user list, group list

### Exit criteria Phase 1
- Email to it-helpdesk@ creates INC ticket within 2 minutes
- Reply with INC in subject adds comment, does NOT create duplicate
- Agent can assign, resolve, close from portal
- 100% of email-created tickets visible in portal
- Audit trail on all actions

Do NOT build: change module, OpenSearch, CMDB, service catalog yet.
```

---

### Phase 2 — Change Management + SLA + Approvals (6–8 weeks)

```text
PHASE 2 — Change Management + SLA + Approvals

Prerequisites: Phase 1 incident + email working.

### Change module
- change_extensions: change_type (standard/normal/emergency), business_justification, implementation_plan, validation_plan, rollback_plan, risk_score, scheduled_start/end
- Change state machine: Draft → Submitted → Risk Review → Technical Review → Approval → Scheduled → Implementation → Validation → Completed/Closed (+ Rollback)
- Emergency abbreviated workflow: fast track to approval → implement → validate → close
- Link changes to related incidents (work_item_relations)

### Approval engine
- Approval policies: sequential and parallel (any/all)
- CAB group approval for normal changes
- Approver inbox UI: approve/reject with comments
- Notify requester and approvers via email (Graph) + in-app

### SLA engine
- Business calendar (hours, holidays, timezone)
- SLA policies matched by priority/category
- Response SLA + resolution SLA on incidents
- FIRST RESPONSE = first human agent action (Start Work or public comment) — NOT auto-ack email
- Pause SLA on Pending User / Pending Vendor
- Breach detection Celery job every 1 min; notify assignee + manager
- Show SLA countdown on ticket detail

### Reporting (basic)
- Dashboard: open incidents, breached SLA, MTTR, change calendar
- Export CSV

### Exit criteria Phase 2
- Normal change cannot reach Scheduled without CAB approval
- Emergency change completes expedited path with post-implementation review
- SLA breach rate measurable; <5% target
- All production changes tracked in system (not email-only)
```

---

### Phase 3 — Hardening + cutover from Outlook (4–6 weeks)

```text
PHASE 3 — Production hardening + email cutover

### Reliability
- Outbox pattern: events in same DB transaction as mutations; Celery publishes to Redis
- Idempotent email processing and event consumers
- Graph throttle handling (429 + Retry-After)
- Health checks: /health for db, redis, graph subscription status
- Backup + restore runbook for PostgreSQL

### Security
- Rate limiting on login and API
- ClamAV scan on attachments
- CSRF for cookie auth
- Kill all sessions on password change

### UX polish
- Saved agent views, ticket templates
- 1-click CSAT thumbs up/down on resolve
- Full-text search on tickets (PostgreSQL tsvector)
- i18n-ready strings (English first)

### Email cutover (the business milestone)
- Parallel run: 4 weeks — both Outlook folder monitoring AND portal
- Train employees: "Email still works, but prefer portal"
- Metric: 100% of it-helpdesk@ emails become tickets (G1)
- Executive sign-off to make portal system of record
- Optional: Outlook rule auto-forwards legacy folders to it-helpdesk@

### Exit criteria Phase 3
- 99.9% uptime target in staging load test
- Pen test remediations closed
- G1: zero lost emails for 4 consecutive weeks
- G8: >40% tickets created via portal
```

---

## 6. Focused prompt — Email integration only

Use this if you want to tackle email first (biggest pain point):

```text
Build Microsoft Graph email-to-ticket integration for our FastAPI ITSM.

Context:
- Internal Microsoft 365 only; shared mailbox it-helpdesk@company.com
- Cannot rely on external SMTP; use Graph sendMail for replies
- Ticket format: INC-YYYYMMDD-#### (regex: INC-\d{8}-\d{4})

Implement:
1. config: tenant_id, client_id, client_secret, mailbox_upn
2. GET/POST /api/v1/email/webhook — validationToken echo as text/plain
3. Create Graph subscription (changeType=created, resource=mailbox inbox messages)
4. Celery beat: renew subscription before expiry; delta poll fallback every 60s
5. email_service.process_message(message_id):
   - Fetch message via Graph
   - Skip if Message-ID already in email_messages
   - Skip OOO (X-Auto-Response-Suppress, Precedence: bulk)
   - Extract body (text/html strip), attachments metadata
   - If ticket ref found AND sender authorized → create comment
   - If ticket ref found AND sender NOT authorized → quarantine status
   - Else → create work_item type=incident, source=email
   - send_auto_ack(display_id, to=sender) via Graph — does not stop SLA
6. Tables: email_messages, graph_subscription_audit
7. Integration tests with mocked Graph responses

Reference existing Node prototype: server/src/services/emailInbound.js (same logic, upgrade to Graph + auth rules).

Deliver: working webhook handler + poll fallback + unit tests.
```

---

## 7. How this maps to your current repo

| You have today | Next step |
|---|---|
| Express + Prisma + React | Migrate to FastAPI + SQLAlchemy **or** evolve existing app first |
| IMAP `emailInbound.js` | Proves the logic; swap transport layer to Graph |
| Tickets with INC-00001 format | Upgrade to `INC-YYYYMMDD-####` per architecture v2 |
| Change + Incident types | Align workflows with ESMP_ARCHITECTURE_v2.md state machines |

**Pragmatic path**: If you need value in 2 weeks, **enhance the existing Node app** email module and incident UI. If you want the long-term platform, **start FastAPI Phase 1** using the master prompt above.

---

## 8. Quick checklist — “Is email tracking working?”

- [ ] Shared mailbox receives employee mail
- [ ] Graph app has Mail.Read (+ Mail.ReadWrite for replies)
- [ ] Webhook URL is HTTPS and validates
- [ ] New email → new INC within 2 minutes
- [ ] Reply email → comment on same INC (not new ticket)
- [ ] Duplicate webhook delivery → no duplicate ticket (Message-ID dedup)
- [ ] Unknown external sender with ticket ref → quarantined
- [ ] Auto-ack includes INC number in subject for threading
- [ ] Agent sees email-created ticket in queue with source=email

---

## 9. References

- [Microsoft Graph change notifications (webhooks)](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
- [Create Graph subscription for mail](https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions)
- Internal architecture: `docs/architecture/ESMP_ARCHITECTURE_v2.md`
- Product requirements: `docs/product/ESMP_PRD.md`

---

*Document version 1.0 — 2026-06-23*
