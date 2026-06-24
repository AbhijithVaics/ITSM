# ESMP Production MVP Review

| Attribute | Value |
|---|---|
| Document Version | 1.0 |
| Date | 2026-06-23 |
| Reviewers | Principal Product Architect, CTO, Enterprise Solution Architect, Delivery Manager |
| Source PRD | [ESMP_PRD.md](./ESMP_PRD.md) v1.2 |
| Mandate | **Do not** change business vision or remove Incident, Change, Outlook email, SLA, RBAC, Audit |

---

## 1. Executive Review

### 1.1 Verdict

**ESMP_PRD.md v1.2 is an excellent enterprise target-state specification.** It correctly describes what a mature ServiceNow-class platform looks like. For a **mid-sized organization** with a **small delivery team (4–8 engineers)**, the current PRD treats **MVP and Year-2 enterprise capabilities as co-equal**, which creates a **12–18 month program disguised as MVP**.

The PRD lists **~25 epics**, **100+ features**, event-driven outbox, dynamic workflow builder, consumer idempotency, hash-chain audit, quorum approval resolution, and 14 admin screens — while the organization only needs:

> Incident + Change + Outlook email tracking + SLA + approvals + basic reporting.

**Recommendation**: **Freeze a Production MVP (Gen-1)** that delivers the vision in **one production release (~5–7 months, 5 engineers)**, then grow in two post-go-live phases. Keep the **Work Item pattern in simplified form**; defer **platform machinery** that exists to support 5,000 users and multi-module expansion on day one.

### 1.2 What Must Not Change

| Pillar | Status |
|---|---|
| Replace lost Outlook threads with tracked tickets | **Core** — unchanged |
| Incident Management | **In MVP** — scope trimmed, not removed |
| Change Management + CAB | **In MVP** — simplified approval paths |
| Microsoft Graph internal email | **In MVP** — P0 |
| SLA (response + resolution) | **In MVP** — basic engine |
| RBAC | **In MVP** — 5–6 roles, not 12 |
| Audit logging | **In MVP** — synchronous append-only log |

### 1.3 Size of the Gap

| Dimension | Current PRD MVP (§14) | Frozen Production MVP |
|---|---|---|
| Epics in MVP | 18+ active | **12** |
| Features (P0) | ~70+ | **~35** |
| Admin screens | 14 | **5** |
| Async infrastructure | Outbox + Redis Streams + idempotent consumers | **Celery for email + SLA timers only** |
| Workflow | DB-driven engine + DAG validator + admin designer | **Code-defined state machines** (2 workflows) |
| Estimated effort | ~120–140 story points × 4 releases in PRD R0–R3 | **~80–100 points, single release train** |

### 1.4 CTO One-Liner

> **Build an internal ITSM that works on Monday, not a platform that could compete with ServiceNow in Year 3.**

---

## 2. Over-Engineered Components

Classification key: **KEEP** | **SIMPLIFY** | **FUTURE** | **REMOVE**

### 2.1 Epic-Level Classification

| Epic | Classification | Reasoning |
|---|---|---|
| EPIC-001 Identity | **SIMPLIFY** | Keep auth/RBAC/groups; defer quiet hours, SSO abstraction, session-kill complexity to Phase 2 |
| EPIC-002 Work Item Core | **SIMPLIFY** | Keep shared core + extensions; defer watchers, relations, tasks, worklogs, templates, saved views, custom fields, bulk jobs |
| EPIC-003 Workflow Engine | **SIMPLIFY** | Keep incident/change lifecycles; **remove** DB workflow builder, DAG Tarjan, custom statuses for MVP |
| EPIC-004 SLA Engine | **SIMPLIFY** | Keep response/resolution + business hours + breach; defer calendar snapshot, denormalized deadline repair jobs, MI freeze, pre-breach %, escalation chains |
| EPIC-005 Approval Engine | **SIMPLIFY** | Keep CAB approve/reject + parallel CAB; defer delegation, quorum, expiry escalation, conditional routing, email-approve |
| EPIC-006 Notification | **SIMPLIFY** | Keep email + in-app + 6 hardcoded templates; defer preferences, quiet hours, digest, @mentions, consumer idempotency |
| EPIC-007 Email Integration | **KEEP** (trim) | Graph webhook, create, reply, auto-ack, dedup are core; defer quarantine UI (log-only), forwarded-email edge cases |
| EPIC-008 Attachments | **SIMPLIFY** | Keep upload/download/size limit; defer ClamAV, classification, versioning, signed URLs to Phase 2 |
| EPIC-009 Audit | **SIMPLIFY** | Keep sync immutable log; defer hash-chain sealing, export UI, advanced search |
| EPIC-010 Incident | **SIMPLIFY** | Keep create/update/assign/priority/categories/reopen; defer major incident, escalation automation, duplicate merge/suggest |
| EPIC-011 Change | **SIMPLIFY** | Keep create/risk/CAB/calendar; defer collision detection, blackout windows, emergency abbreviated workflow, supersede policy |
| EPIC-012 Reporting | **KEEP** (minimal) | 3 dashboard widgets only for MVP |
| EPIC-013 Search | **KEEP** (minimal) | PostgreSQL `ILIKE` + display_id lookup; not full tsvector ranking |
| EPIC-014 Platform Services | **FUTURE** | Outbox, feature flags, webhooks, idempotency framework — not Gen-1 |
| EPIC-015 Admin | **SIMPLIFY** | Users, groups, SLA config, Graph config only |
| EPIC-016–017 UI | **KEEP** (trim) | Core screens only; no conflict-merge UI v1 |
| EPIC-018 Manager Console | **SIMPLIFY** | Merge into single dashboard |
| EPIC-019–024 | **FUTURE** | Already out of scope |
| EPIC-025 Migration | **KEEP** (trim) | Parallel-run playbook + user import; defer legacy ticket import |

### 2.2 Feature-Level Classification (All FEAT-* in PRD)

#### EPIC-001

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-001-01 JWT Auth | **KEEP** | Required |
| FEAT-001-02 RBAC | **KEEP** | Required |
| FEAT-001-03 Groups | **KEEP** | Required for assignment + CAB |
| FEAT-001-04 Scope visibility | **KEEP** | Required |
| FEAT-001-05 Session kill | **FUTURE** | Phase 2 security hardening |
| FEAT-001-06 Profile/preferences | **FUTURE** | Phase 2 |
| FEAT-001-07 Quiet hours | **FUTURE** | Phase 2 |
| FEAT-001-08 SSO/Keycloak | **FUTURE** | Phase 2 |
| FEAT-001-09 i18n externalization | **FUTURE** | English-only MVP |

#### EPIC-002

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-002-01 Work Item CRUD | **KEEP** | Core |
| FEAT-002-02 Display ID | **KEEP** | SIMPLIFY: `INC-00001` sequential OK for Gen-1 if team prefers; date-prefix optional |
| FEAT-002-03 lock_version / 409 | **FUTURE** | Phase 2; use `updated_at` check or accept rare collision for Gen-1 |
| FEAT-002-04 Idempotency-Key API | **FUTURE** | Phase 2; email Message-ID dedup only in MVP |
| FEAT-002-05 Comments | **KEEP** | Required |
| FEAT-002-06 Watchers | **FUTURE** | Phase 2 |
| FEAT-002-07 Relations | **FUTURE** | Phase 2 (incident↔change link nice-to-have Phase 2) |
| FEAT-002-08 Tasks | **FUTURE** | Phase 2 |
| FEAT-002-09 Worklogs | **FUTURE** | Phase 2 |
| FEAT-002-10 Templates | **FUTURE** | Phase 2 |
| FEAT-002-11 Saved views | **FUTURE** | Phase 2 |
| FEAT-002-12 Custom fields | **FUTURE** | Phase 3 |
| FEAT-002-13 Activity timeline | **SIMPLIFY** | Merge comments + status changes in one query; not event-sourced |
| FEAT-002-14 Bulk jobs | **FUTURE** | Phase 3 |

#### EPIC-003

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-003-01 DB workflow definitions | **REMOVE** (MVP) | Replace with code-defined machines |
| FEAT-003-02 Incident state machine | **KEEP** | Hardcoded in `incident_workflow.py` |
| FEAT-003-03 Change state machine | **KEEP** | Hardcoded |
| FEAT-003-04 Guards | **SIMPLIFY** | 3–4 guards in code (authorized, has_assignee, has_resolution) |
| FEAT-003-05 Hooks | **SIMPLIFY** | Direct function calls: notify, sla_start/stop — not plugin registry |
| FEAT-003-06 DAG validation | **REMOVE** (MVP) | No admin workflow editor |
| FEAT-003-07 Emergency change workflow | **SIMPLIFY** | Same CAB with `expedited=true` flag; one fewer state machine |
| FEAT-003-08 Auto-close sweep | **KEEP** | Simple cron: Resolved >7 days → Closed |
| FEAT-003-09 Custom statuses | **FUTURE** | Phase 3 |

#### EPIC-004

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-004-01 SLA policies | **SIMPLIFY** | 1 default policy per type + priority override table |
| FEAT-004-02 Business calendar | **KEEP** | Single org calendar |
| FEAT-004-03 Response/resolution tracking | **KEEP** | Core |
| FEAT-004-04 First response semantics | **KEEP** | Critical for accurate SLA |
| FEAT-004-05 Pause/resume | **SIMPLIFY** | Pause on `pending_user` only for Gen-1 |
| FEAT-004-06 Breach detection | **KEEP** | Celery job every 5 min acceptable |
| FEAT-004-07 SLA display on ticket | **KEEP** | Core |
| FEAT-004-08 Calendar snapshot | **FUTURE** | Phase 2 |
| FEAT-004-09 Denormalized deadline | **SIMPLIFY** | Optional; sort by computed column or simple index |
| FEAT-004-10 Pre-breach warnings | **FUTURE** | Phase 2 |
| FEAT-004-11 Escalation on breach | **FUTURE** | Phase 2 (notify manager manually OK in Gen-1) |
| FEAT-004-12 MI SLA freeze | **FUTURE** | Phase 2 (MI itself deferred) |
| FEAT-004-13 SLA override | **FUTURE** | Phase 2 |

#### EPIC-005

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-005-01 Approval policies | **SIMPLIFY** | One CAB policy hardcoded |
| FEAT-005-02 Sequential chains | **FUTURE** | Phase 2 |
| FEAT-005-03 Parallel CAB (any) | **KEEP** | Required for change governance |
| FEAT-005-04 Delegation | **FUTURE** | Phase 2 |
| FEAT-005-05–07 Notifications/decisions | **KEEP** | Core |
| FEAT-005-08–11 Advanced routing | **FUTURE** | Phase 2–3 |
| FEAT-005-12 Email approve | **FUTURE** | Phase 2 |
| FEAT-005-13 Consumer idempotency | **FUTURE** | Phase 2 |

#### EPIC-006

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-006-01 Event dispatch | **SIMPLIFY** | Direct call after DB commit; no outbox |
| FEAT-006-02 Email channel | **KEEP** | Via Graph |
| FEAT-006-03 In-app | **KEEP** | Polling or SSE; not full WS cluster |
| FEAT-006-04 Templates | **SIMPLIFY** | 6 files in repo, not admin editor |
| FEAT-006-05 Delivery log | **SIMPLIFY** | Log table; no retry engine v1 |
| FEAT-006-06 Skip inactive | **KEEP** | Trivial |
| FEAT-006-07–12 Advanced | **FUTURE** | Phase 2 |

#### EPIC-007

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-007-01–04 Graph + create | **KEEP** | Core |
| FEAT-007-05 Ticket ref detection | **KEEP** | Core |
| FEAT-007-06 Reply → comment | **KEEP** | Core |
| FEAT-007-07 Attachments from email | **SIMPLIFY** | Metadata only if >10MB; defer virus scan |
| FEAT-007-08 Auto-ack | **KEEP** | Core |
| FEAT-007-09 OOO/spam | **SIMPLIFY** | OOO skip only |
| FEAT-007-10 Message-ID dedup | **KEEP** | Critical |
| FEAT-007-11 Thread mapping | **KEEP** | Core |
| FEAT-007-12 Email history | **SIMPLIFY** | Store headers + body text; not full MIME archive |
| FEAT-007-13 Graph lifecycle | **KEEP** | Subscription renew + delta fallback required |
| FEAT-007-14 Quarantine | **SIMPLIFY** | Log + admin list; no fancy UI |
| FEAT-007-15–16 Edge cases | **FUTURE** | Phase 2 |

#### EPIC-008

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-008-01 Upload | **KEEP** | Core |
| FEAT-008-02 ClamAV | **FUTURE** | Phase 2 |
| FEAT-008-03 Allowlist | **SIMPLIFY** | Extension blocklist in config |
| FEAT-008-04–10 Advanced | **FUTURE** | Phase 2–3 |

#### EPIC-009

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-009-01 Immutable audit | **KEEP** | Sync write on mutation |
| FEAT-009-02 Actor/old/new | **KEEP** | Core |
| FEAT-009-03 IP/UA | **SIMPLIFY** | Log if easy |
| FEAT-009-04 Retention 7yr | **KEEP** | Policy only; no purge automation v1 |
| FEAT-009-05–08 Hash chain/export | **FUTURE** | Phase 2–3 |

#### EPIC-010

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-010-01 Portal create | **KEEP** | Core |
| FEAT-010-02 Email create | **KEEP** | Core |
| FEAT-010-03 Priority matrix | **KEEP** | Core |
| FEAT-010-04 Categories | **KEEP** | Fixed enum list |
| FEAT-010-05 Assignment | **KEEP** | Core |
| FEAT-010-06 Major incident | **FUTURE** | Phase 2 |
| FEAT-010-07 Reopen | **SIMPLIFY** | Reopen allowed; no max-count enforcement v1 |
| FEAT-010-08 Escalation | **FUTURE** | Phase 2 |
| FEAT-010-09–14 Advanced | **FUTURE** | Phase 2 |
| FEAT-010-15 CSAT | **FUTURE** | Phase 2 |

#### EPIC-011

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-011-01 Change create | **KEEP** | Core |
| FEAT-011-02 Plans | **KEEP** | Core |
| FEAT-011-03 Risk scoring | **SIMPLIFY** | Manual risk dropdown + optional score formula |
| FEAT-011-04 Emergency | **SIMPLIFY** | Flag + expedited CAB |
| FEAT-011-05 CAB | **KEEP** | Core |
| FEAT-011-06 Schedule | **KEEP** | Core |
| FEAT-011-07 Calendar view | **KEEP** | Core |
| FEAT-011-08 Stakeholder notify | **KEEP** | Core |
| FEAT-011-09 PIR | **SIMPLIFY** | Text field on close; not workflow gate |
| FEAT-011-10–16 Advanced | **FUTURE** | Phase 2–3 |

#### EPIC-012–014, UI

| Feature | Class | Reasoning |
|---|---|---|
| FEAT-012-01 Dashboard | **KEEP** | 3 widgets |
| FEAT-012-02 Export CSV | **FUTURE** | Phase 2 |
| FEAT-013-01 Search | **KEEP** | Simple SQL |
| FEAT-014-* Platform | **FUTURE** | Phase 2–3 |
| FEAT-016/17 UI | **KEEP** | Core screens |
| FEAT-017-03 Conflict UI | **FUTURE** | Phase 2 |
| FEAT-018-* Manager | **SIMPLIFY** | Merge to dashboard |
| FEAT-025-* Migration | **KEEP** | Parallel run essential |

### 2.3 User Stories & AC — Summary

| Area | MVP treatment |
|---|---|
| US-001 through US-011 core paths | **KEEP** |
| US-003-04 DAG / workflow admin | **FUTURE** |
| US-010-03 Major incident | **FUTURE** |
| US-010-06 CSAT | **FUTURE** |
| US-013 Search | **KEEP** (simplified AC) |
| AC-002-02/03 lock_version, idempotency | **FUTURE** |
| AC-014-01 Outbox | **FUTURE** — replace with "notification sent within 30s of action" |
| AC-EMAIL-MVP-01–07 | **KEEP** |
| §52 Go-Live 40+ items | **SIMPLIFY** to 15-item Gen-1 checklist |

---

## 3. Simplified MVP Scope (FROZEN)

**Production MVP (Gen-1)** — the only release that may go to production.

### 3.1 Identity

| Capability | In MVP |
|---|---|
| Login (JWT) | Yes |
| Roles: requester, agent, change_manager, cab_member, admin | Yes |
| Users CRUD | Yes |
| Groups (assignment + CAB) | Yes |
| Requester sees own; agent sees group queue | Yes |

### 3.2 Incident Management

| Capability | In MVP |
|---|---|
| Create (portal + email) | Yes |
| Update fields | Yes |
| Assign to user/group | Yes |
| Public + internal comments | Yes |
| Attachments (basic) | Yes |
| Status workflow (code-defined) | Yes |
| Priority matrix (urgency × impact) | Yes |
| Categories (fixed list) | Yes |
| Search (title, display_id, reporter) | Yes |

### 3.3 Email Integration

| Capability | In MVP |
|---|---|
| Microsoft Graph API | Yes |
| Email → new incident | Yes |
| Reply → comment | Yes |
| Auto-acknowledgement (Graph sendMail) | Yes |
| Message-ID dedup | Yes |
| Subscription renewal + delta fallback | Yes |

### 3.4 Notifications

| Capability | In MVP |
|---|---|
| Email (Graph, internal) | Yes |
| In-app notification list | Yes |
| Events: created, assigned, comment, resolved, approval requested/decided | Yes |

### 3.5 Audit

| Capability | In MVP |
|---|---|
| Log all create/update/delete | Yes |
| Actor, timestamp, entity, old/new JSON | Yes |
| Admin read-only audit screen | Yes |

### 3.6 Basic SLA

| Capability | In MVP |
|---|---|
| Response SLA | Yes |
| Resolution SLA | Yes |
| Business hours (Mon–Fri, org timezone) | Yes |
| Pause on pending_user | Yes |
| Breach flag + notify assignee | Yes |
| SLA countdown on ticket | Yes |
| First response = human action (not auto-ack) | Yes |

### 3.7 Dashboard

| Widget | In MVP |
|---|---|
| Open tickets by status | Yes |
| SLA breached / at risk count | Yes |
| Team workload (tickets per agent) | Yes |

### 3.8 Change Management

| Capability | In MVP |
|---|---|
| Create change (normal; expedited flag) | Yes |
| Risk assessment (manual + simple score) | Yes |
| Implementation / rollback / validation plans | Yes |
| CAB approval (parallel, any approver) | Yes |
| Change calendar (list + calendar view) | Yes |
| Scheduled start/end | Yes |

### 3.9 Explicitly NOT in Production MVP

Outbox, Redis Streams, feature flags, dynamic workflow builder, hash-chain audit, quorum approvals, delegation, major incident, collision detection, CSAT, custom fields, saved views, templates, watchers, OpenSearch, webhooks, bulk ops, ClamAV, SSO, i18n, conflict-merge UI, idempotency API headers, lock_version.

---

## 4. Features Deferred to Future

### 4.1 User-Requested Complex Items

| Item | Why not MVP | Risk if in MVP | Phase |
|---|---|---|---|
| **Dynamic Workflow Builder** | Admin UI + DAG validator + versioning = 6–8 weeks alone | Team never ships incident/email | **Phase 2** |
| **Generic Workflow Engine UI** | Same as above | Configuration bugs block all tickets | **Phase 2** |
| **Feature Flags** | No multi-tenant rollout needed for 1 org | Premature abstraction | **Phase 3** |
| **AI Copilot** | Not requested for Gen-1 | Distraction | **Phase 3** |
| **Knowledge Base** | Not in org requirements | Scope creep | **Phase 2** |
| **Service Catalog** | Not in org requirements | Second product | **Phase 2** |
| **CMDB** | Not in org requirements | You have CMDB in Node app — defer port | **Phase 3** |
| **Asset Management** | Not required | — | **Phase 3** |
| **OpenSearch** | PG search sufficient <50k tickets | Ops burden | **Phase 2** |
| **Mobile Apps** | Portal is responsive enough | 2× frontend effort | **Phase 3** |
| **Teams Integration** | Email + portal sufficient | Integration maintenance | **Phase 2** |
| **Slack Integration** | Same | Same | **Phase 2** |
| **Advanced Delegation** | CAB has backup humans in small org | Complex approval graph | **Phase 2** |
| **Quorum Deadlock Resolution** | Edge case for large approver groups | Over-engineering for 3–5 CAB members | **Phase 2** |
| **Hash Chain Audit** | Legal rarely requires crypto seal at Gen-1 | Engineering weeks | **Phase 3** |
| **Advanced Approval Routing** | Conditional routing | — | **Phase 2** |
| **Dynamic Form Builder** | Fixed forms work | — | **Phase 3** |
| **Webhook Marketplace** | No external consumers day one | — | **Phase 2** |
| **Complex Rule Engine** | Business rules in code for Gen-1 | — | **Phase 3** |

### 4.2 PRD Items Deferred (Not in User List but Over-Engineered)

| Item | Phase | Reason |
|---|---|---|
| Event outbox + Redis Streams | Phase 2 | Sync notifications adequate for <500 users |
| API Idempotency-Key framework | Phase 2 | Email dedup sufficient |
| Optimistic concurrency UI | Phase 2 | Low collision rate small team |
| Major incident protocol | Phase 2 | Manual bridge OK initially |
| Materialized view dashboards | Phase 2 | Live SQL OK at scale |
| 12 RBAC roles | Phase 2 | 5 roles enough |
| 14 admin screens | Phase 2 | 5 screens enough |
| Consumer idempotency | Phase 2 | Tied to outbox |
| Calendar snapshot for SLA | Phase 2 | Single calendar rarely changes |
| Email quarantine workflow UI | Phase 2 | Log file OK |

---

## 5. Recommended Architecture Simplifications

### 5.1 Work Item Model — Decision

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A — Keep Work Item** | `work_items` + `incident_extensions` + `change_extensions` | Shared comments, audit, email threading, search; matches architecture v2; one queue query | Slightly more joins than flat tables |
| **B — Separate tables** | `incidents` and `changes` fully separate | Simpler per-module queries | Duplicate comments, audit, email, SLA, notification logic — **2× code** for small team |

### 5.2 Recommendation: **Option A (Simplified)**

**Keep the Work Item base model** with extension tables, but simplify implementation:

| Layer | Gen-1 approach | Enterprise PRD approach |
|---|---|---|
| Work item table | **KEEP** | Same |
| Extension tables | **KEEP** | Same |
| Workflows | **Hardcoded** Python enums + transition dict | DB-driven + admin UI |
| SLA | **Service class** with 1 calendar | Policy engine + snapshots |
| Approvals | **Table** `approvals` + simple state | Policy engine + quorum |
| Events | **Direct function calls** | Outbox + Redis Streams |
| Notifications | **6 template strings** | Template admin + mapping engine |

**Do not split to Option B** — a team of 5 cannot maintain duplicated comment/audit/email paths for incidents and changes.

### 5.3 Infrastructure Gen-1

| Component | Gen-1 | Defer |
|---|---|---|
| PostgreSQL | Required | — |
| FastAPI + React | Required | — |
| Redis + Celery | Email parse queue + SLA cron | Redis Streams |
| MinIO | Optional; local disk OK for Gen-1 | Distributed MinIO |
| Nginx | Production TLS | — |
| OpenSearch | No | Phase 2 |
| Kubernetes | Docker Compose / single VM OK | K8s HPA |

### 5.4 Email Architecture (Unchanged — KEEP)

Graph webhook → parse → create/comment → Graph auto-ack is **correct and minimal**. Do not replace with IMAP in production.

---

## 6. Revised Epic List (Production MVP)

| Epic ID | Name | Gen-1 | Notes |
|---|---|---|---|
| **E-01** | Identity & RBAC | ✅ | 5 roles |
| **E-02** | Work Item Core (simplified) | ✅ | No bulk/custom fields |
| **E-03** | Incident Management | ✅ | |
| **E-04** | Change Management | ✅ | |
| **E-05** | Code-Defined Workflows | ✅ | Replaces EPIC-003 builder |
| **E-06** | Basic SLA | ✅ | |
| **E-07** | CAB Approvals (simple) | ✅ | |
| **E-08** | Notifications (email + in-app) | ✅ | |
| **E-09** | Outlook / Graph Email | ✅ | |
| **E-10** | Attachments (basic) | ✅ | |
| **E-11** | Audit Log | ✅ | |
| **E-12** | Search (SQL) | ✅ | |
| **E-13** | Operations Dashboard | ✅ | |
| **E-14** | Portals (Employee + Agent + Change) | ✅ | |
| **E-15** | Go-Live & Cutover | ✅ | |
| — | Platform Services (EPIC-014) | ❌ | Phase 2 |
| — | Enterprise modules (EPIC-019–24) | ❌ | Phase 2–3 |

---

## 7. Revised Feature List (Production MVP Only)

| ID | Feature | Epic |
|---|---|---|
| F-01 | JWT login | E-01 |
| F-02 | RBAC middleware (5 roles) | E-01 |
| F-03 | User admin | E-01 |
| F-04 | Group admin (assignment + CAB) | E-01 |
| F-05 | Work item create/read/update/list | E-02 |
| F-06 | Display ID INC-/CHG- | E-02 |
| F-07 | Public + internal comments | E-02 |
| F-08 | Activity feed (comments + status) | E-02 |
| F-09 | Incident create (portal) | E-03 |
| F-10 | Priority matrix | E-03 |
| F-11 | Categories | E-03 |
| F-12 | Assignment | E-03 |
| F-13 | Incident status transitions | E-05 |
| F-14 | Change create + plans | E-04 |
| F-15 | Risk assessment | E-04 |
| F-16 | Change status transitions | E-05 |
| F-17 | CAB parallel approval | E-07 |
| F-18 | Change calendar | E-04 |
| F-19 | Response + resolution SLA | E-06 |
| F-20 | Business hours | E-06 |
| F-21 | SLA breach detection | E-06 |
| F-22 | Graph connect + webhook | E-09 |
| F-23 | Email → incident | E-09 |
| F-24 | Reply → comment | E-09 |
| F-25 | Auto-ack | E-09 |
| F-26 | Message-ID dedup | E-09 |
| F-27 | Graph subscription renewal | E-09 |
| F-28 | Notification email (Graph) | E-08 |
| F-29 | Notification in-app | E-08 |
| F-30 | Audit log write | E-11 |
| F-31 | Audit log viewer | E-11 |
| F-32 | File upload on ticket | E-10 |
| F-33 | Ticket search | E-12 |
| F-34 | Dashboard: open / SLA / workload | E-13 |
| F-35 | Employee portal screens | E-14 |
| F-36 | Agent queue + detail | E-14 |
| F-37 | Change + approval screens | E-14 |
| F-38 | Parallel-run cutover playbook | E-15 |

**Total: 38 features** (down from 100+).

---

## 8. Final Production Roadmap

**Team assumption**: 5 engineers (2 backend, 2 frontend, 1 full-stack/DevOps), 1 PM, 1 QA part-time.

### Phase 1 — Production MVP (Months 1–7)

**Goal**: Internal go-live; 100% support emails tracked; incidents + changes governed.

| Order | Deliverable | Complexity | Business Value | Duration |
|---|---|---|---|---|
| 1 | Auth, users, groups, RBAC | M | Foundation | 3 weeks |
| 2 | Work items + incidents + code workflow | L | Core product | 4 weeks |
| 3 | Comments + attachments + audit | M | Daily use | 3 weeks |
| 4 | Agent + employee React UI | L | Adoption | 4 weeks |
| 5 | Graph email integration | XL | **#1 pain point** | 5 weeks |
| 6 | Basic SLA + notifications | L | Accountability | 4 weeks |
| 7 | Search + dashboard | S | Visibility | 2 weeks |
| 8 | Change + CAB + calendar | L | Governance | 5 weeks |
| 9 | Hardening, pilot, cutover | M | Production | 4 weeks |

**Phase 1 total**: ~34 weeks ≈ **7 months** (with overlap/parallelism → **5–6 months**)

| Metric | Target |
|---|---|
| Users | 100–300 |
| G1 email tracking | 100% |
| Availability | 99% (single instance) |

### Phase 2 — Post Go-Live (Months 8–14)

**Goal**: Operational maturity; reduce manual work.

| Feature | Complexity | Value |
|---|---|---|
| Major incident mode | M | Outage handling |
| SLA escalation + pre-breach warnings | M | Proactive management |
| Approval delegation + expiry | M | CAB flexibility |
| Saved views + templates | S | Agent efficiency |
| CSAT on resolve | S | G5 measurement |
| Export CSV/PDF reports | S | Management |
| ClamAV attachments | M | Security |
| Outbox + reliable async notifications | L | Scale prep |
| OpenSearch (if ticket volume >50k) | L | Search scale |
| SSO / Keycloak | M | Enterprise auth |
| Dynamic workflow admin (read-only first) | L | Process agility |
| Problem management (light) | M | RCA tracking |
| Webhooks (outbound) | M | Integrations |

### Phase 3 — Enterprise Expansion (Months 15–24)

**Goal**: Multi-module platform; only if organization demands.

| Feature | Complexity | Value |
|---|---|---|
| Service catalog + KB | XL | Deflection |
| CMDB / assets (port from Node app) | XL | Change accuracy |
| Feature flags | M | Safe rollout |
| Hash-chain audit | M | Compliance |
| AI categorization | L | Efficiency |
| Mobile app | XL | Field access |
| Teams/Slack | M | Collaboration |
| Multi-tenant / advanced RBAC | XL | Scale |

---

## 9. CTO Recommendation

### 9.1 Decision

**Approve Production MVP (Gen-1) as defined in §3 of this review.** Treat ESMP_PRD.md v1.2 as **target-state reference**, not **sprint backlog**. Create **ESMP_PRD_v1.3** (or appendix) that replaces §14 MVP with §3 of this document.

### 9.2 Prioritization Principles

1. **Email first after auth** — if Graph works, the organization sees value immediately (G1).
2. **Code workflows, not configurable workflows** — ship incident/change lifecycles in Python; add admin editor when processes stabilize.
3. **Synchronous side effects** — notify and audit in the request thread until >500 concurrent users.
4. **One calendar, one SLA policy per type** — configurability grows in Phase 2.
5. **Reuse existing Node prototype logic** — email ref detection, priority matrix, state machines are proven; port, don't rewrite blindly.
6. **Do not port CMDB to Gen-1** — existing app has it; decouple from ITSM go-live.

### 9.3 Risk if Team Builds Full PRD MVP

| Risk | Likelihood | Impact |
|---|---|---|
| 12+ month delivery | High | Organization loses faith; emails keep getting lost |
| Team burnout on platform plumbing | High | Incident UI incomplete |
| Graph integration delayed by outbox/R0 sequencing | Medium | Core value missed |
| Over-configurable workflows with no users | Medium | Maintenance nightmare |

### 9.4 Risk if Team Builds Frozen MVP

| Risk | Mitigation |
|---|---|
| Workflow changes need deploy | Acceptable Gen-1; 2–4 changes/year |
| No optimistic concurrency | Train agents; add in Phase 2 |
| Single-server scale limit | Fine for 300 users; plan Phase 2 outbox |
| Manual CAB delegation | CAB size 3–5; phone escalation OK |

### 9.5 Success Definition for Gen-1 Go-Live

- [ ] Employee emails Outlook → ticket within 2 minutes
- [ ] Agent resolves in portal; requester notified
- [ ] SLA breach visible on dashboard
- [ ] Normal change requires CAB approval before schedule
- [ ] Audit log answers "who changed this ticket?"
- [ ] 4-week parallel run complete; IT signs email cutover

### 9.6 Final Statement

The **vision is correct and unchanged**: internal ServiceNow-class ITSM with Outlook intake. The **execution plan must shrink** to what a small team can ship and operate. **Option A Work Item architecture stays**, but **platform enterprise patterns move to Phase 2**. Build Gen-1, deploy internally, learn from real agents — then grow the platform using the existing PRD as a north star, not a day-one checklist.

---

## Appendix: PRD Section Mapping

| This review | Update in ESMP_PRD.md |
|---|---|
| §3 Frozen MVP | Replace §14.1 |
| §6 Revised epics | Replace §7 table |
| §7 Revised features | Add §8.1 "Gen-1 Feature Set" |
| §8 Roadmap | Replace §17 release train |
| §2 Classifications | Add §14.5 "Deferred from Gen-1" |

**Next action**: Product owner approves this review → PRD v1.3 patch (documentation only, no vision change).

---

*End of Production MVP Review*
