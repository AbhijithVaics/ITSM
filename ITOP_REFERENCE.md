# iTop Reference Specification
## Complete Business Logic Extraction for PERN Stack Rewrite

> **Source:** Combodo iTop (https://github.com/Combodo/iTop)  
> **Purpose:** Reference document for building a custom ITSM platform (Incident, Service Request, Change, Problem, CMDB, SLA, Email-to-Ticket, RBAC, Audit)  
> **Target Stack:** PostgreSQL, Express.js, React (Vite), Node.js

---

## Table of Contents

1. [Core Data Models](#1-core-data-models)
   - 1.1 [Organization](#11-organization)
   - 1.2 [Person / Contact / Team](#12-person--contact--team)
   - 1.3 [Ticket (Abstract Base)](#13-ticket-abstract-base)
   - 1.4 [UserRequest](#14-userrequest)
   - 1.5 [Incident](#15-incident)
   - 1.6 [Change](#16-change)
   - 1.7 [Problem](#17-problem)
   - 1.8 [WorkOrder](#18-workorder)
   - 1.9 [Service / SLA / SLT / Contract](#19-service--sla--slt--contract)
2. [CMDB — Configuration Management Database](#2-cmdb--configuration-management-database)
   - 2.1 [Class Hierarchy](#21-class-hierarchy)
   - 2.2 [CI-to-CI Relationships](#22-ci-to-ci-relationships)
3. [Lifecycle State Machines](#3-lifecycle-state-machines)
   - 3.1 [UserRequest — Complete State Machine](#31-userrequest--complete-state-machine)
   - 3.2 [Incident — State Machine](#32-incident--state-machine)
   - 3.3 [Change — State Machines (4 variants)](#33-change--state-machines-4-variants)
   - 3.4 [Problem — State Machine](#34-problem--state-machine)
   - 3.5 [Transition Actions Reference](#35-transition-actions-reference)
4. [SLA Engine](#4-sla-engine)
   - 4.1 [StopWatch Mechanism](#41-stopwatch-mechanism)
   - 4.2 [Business Hours Algorithm](#42-business-hours-algorithm)
   - 4.3 [TTO (Time to Own)](#43-tto-time-to-own)
   - 4.4 [TTR (Time to Resolve)](#44-ttr-time-to-resolve)
   - 4.5 [SLT Lookup OQL](#45-slt-lookup-oql)
5. [Priority Matrix](#5-priority-matrix)
6. [Email-to-Ticket](#6-email-to-ticket)
   - 6.1 [Current iTop Implementation](#61-current-itop-implementation)
   - 6.2 [Desired Enhancement Spec](#62-desired-enhancement-spec)
7. [RBAC — Role-Based Access Control](#7-rbac--role-based-access-control)
   - 7.1 [Profiles & Permissions](#71-profiles--permissions)
   - 7.2 [Stimulus-Level Access](#72-stimulus-level-access)
8. [Audit Trail](#8-audit-trail)
9. [Reference Data: Enum Values](#9-reference-data-enum-values)

---

## 1. Core Data Models

### 1.1 Organization

| Field | Type | Notes |
|---|---|---|
| `id` | Auto-increment PK | |
| `name` | String, required | |
| `code` | String, optional | |
| `status` | Enum: active, inactive | |
| `parent_id` | FK → Organization (self) | Hierarchical org tree |
| `creation_date` | DateTime | |
| `migration_date` | DateTime | |

**DB Table:** `organization`  
**Parent Class:** `cmdbAbstractObject`  
**Reconciliation:** `name`

---

### 1.2 Person / Contact / Team

#### Contact (abstract parent)

| Field | Type | Notes |
|---|---|---|
| `id` | Auto-increment PK | |
| `name` | String, required | |
| `first_name` | String | |
| `email` | String | Used for email-to-caller mapping |
| `phone` | String | |
| `mobile_phone` | String | |
| `org_id` | FK → Organization, required | |
| `status` | Enum: active, inactive | |
| `function` | String | Job title |
| `location_id` | FK → Location | |

**DB Table:** `contact` (abstract — data in `person` and `team` subtables)

#### Person (extends Contact)

| Field | Type | Notes |
|---|---|---|
| *All Contact fields* | | |
| `manager_id` | FK → Person (self) | Self-referential |
| `notify` | Boolean | |

**DB Table:** `person`  
**Ref Format:** Person entries are linked to User accounts

#### Team (extends Contact)

| Field | Type | Notes |
|---|---|---|
| *All Contact fields* | | |
| `email` | String | Team email alias |
| `tickets_list` | LinkedSet → Ticket | Via `team_id` |

**DB Table:** `team`  
**Team Membership:** `lnkPersonToTeam(person_id, team_id, role_id)`

#### lnkPersonToTeam

| Field | Type |
|---|---|
| `person_id` | FK → Person |
| `team_id` | FK → Team |
| `role_id` | FK → ContactType (Typology) |

**DB Table:** `lnkpersontoteam`  
**Is Link:** Yes (unique constraint on person_id + team_id)

---

### 1.3 Ticket (Abstract Base)

**DB Table:** `ticket`  
**Parent Class:** `cmdbAbstractObject`  
**Abstract:** Yes (discriminator via `finalclass`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | Auto-increment PK | | | |
| `finalclass` | String | | | Discriminator: UserRequest, Incident, Change, Problem |
| `ref` | String | No | Auto | Format: `T-%06d` (overridden by subclasses) |
| `org_id` | FK → Organization | **Yes** | | Customer organization |
| `org_name` | ExternalField | | | From org_id → name |
| `caller_id` | FK → Person | No | | Filtered by org_id |
| `caller_name` | ExternalField | | | From caller_id → name |
| `team_id` | FK → Team | No | | Assigned team |
| `team_name` | ExternalField | | | From team_id → name |
| `team_email` | ExternalField | | | From team_id → email |
| `agent_id` | FK → Person | No | | Filtered by team_id (must be team member) |
| `agent_name` | ExternalField | | | From agent_id → name |
| `title` | String | **Yes** | | |
| `description` | HTML Text | **Yes** | | |
| `start_date` | DateTime | No | | Set on creation |
| `end_date` | DateTime | No | | |
| `last_update` | DateTime | No | | Auto-updated |
| `close_date` | DateTime | No | | Set on closure |
| `operational_status` | MetaEnum | | `ongoing` | Maps to status: ongoing/open, resolved, closed |
| `private_log` | CaseLog | No | | Internal agent notes |
| `contacts_list` | LinkedSetIndirect | | | Via `lnkContactToTicket` |
| `workorders_list` | LinkedSet | | | Via WorkOrder.ticket_id |

**Ref Generation:**
```
Ticket base:    T-000001
UserRequest:    R-000001
Incident:       I-000001
Change:         C-000001
Problem:        P-000001
```

**Indexes:** `ref`, `finalclass + ref`

---

### 1.4 UserRequest

**DB Table:** `ticket_request`  
**Parent:** Ticket  
**Type Discriminator:** `service_request` | `incident`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| *All Ticket fields* | | | | |
| `status` | Enum | **Yes** | `new` | 10 states (see lifecycle) |
| `request_type` | Enum | No | | `incident` | `service_request` |
| `impact` | Enum: 1-3 | | `1` | 1=org-wide, 2=group, 3=individual |
| `urgency` | Enum: 1-4 | | `4` | 1=critical → 4=low |
| `priority` | Enum: 1-4 | | `4` | Computed: impact × urgency matrix |
| `origin` | Enum | No | `phone` | `in_person`, `chat`, `mail`, `phone`, `portal`, `monitoring` |
| `service_id` | FK → Service | No | | Filtered by org_id + contract |
| `service_name` | ExternalField | | | |
| `servicesubcategory_id` | FK → ServiceSubcategory | No | | Filtered by service_id |
| `servicesubcategory_name` | ExternalField | | | |
| `approver_id` | FK → Person | No | | |
| `approver_email` | ExternalField | | | |
| `escalation_flag` | Enum: yes/no | | `no` | |
| `escalation_reason` | String | No | | |
| `assignment_date` | DateTime | No | | Set on ev_assign |
| `resolution_date` | DateTime | No | | Set on ev_resolve |
| `last_pending_date` | DateTime | No | | Set on ev_pending |
| `cumulatedpending` | StopWatch | | | Tracks time in 'pending' state |
| `tto` | StopWatch | | | TTO deadline (see SLA section) |
| `ttr` | StopWatch | | | TTR deadline (see SLA section) |
| `tto_escalation_deadline` | SubItem | | | `tto.100_deadline` |
| `sla_tto_passed` | SubItem | | | `tto.100_passed` |
| `sla_tto_over` | SubItem | | | `tto.100_overrun` |
| `tto_time_spent` | SubItem | | | `tto.timespent` |
| `ttr_escalation_deadline` | SubItem | | | `ttr.100_deadline` |
| `sla_ttr_passed` | SubItem | | | `ttr.100_passed` |
| `sla_ttr_over` | SubItem | | | `ttr.100_overrun` |
| `ttr_time_spent` | SubItem | | | `ttr.timespent` |
| `time_spent` | Duration | No | | Computed on resolution |
| `resolution_code` | Enum | No | `assistance` | `assistance`, `other`, `software patch`, `training`, `hardware repair`, `system update`, `bug fixed` |
| `solution` | HTML Text | No | | |
| `pending_reason` | Text | No | | |
| `parent_request_id` | FK → UserRequest | No | | Parent-child ticket linking |
| `parent_request_ref` | ExternalField | | | |
| `parent_problem_id` | FK → Problem | No | | |
| `parent_problem_ref` | ExternalField | | | |
| `parent_change_id` | FK → Change | No | | |
| `parent_change_ref` | ExternalField | | | |
| `related_request_list` | LinkedSet | | | Child UserRequests |
| `public_log` | CaseLog | No | | Employee-visible timeline |
| `user_satisfaction` | Enum: 1-4 | | `1` | Collected on closure |
| `user_comment` | Text | No | | |

---

### 1.5 Incident

**DB Table:** `ticket_incident`  
**Parent:** Ticket

**Key differences from UserRequest:**
- **7 states** (no `waiting_for_approval`, `approved`, `rejected`)
- TTO active in: `new`, `escalated_tto`
- TTR active in: `new`, `escalated_tto`, `assigned`, `escalated_ttr`
- Same priority matrix (impact × urgency)
- Same SLA sub-items (tto, ttr deadlines)
- Has `parent_incident_id` and `child_incidents_list` for incident hierarchy
- Links to `parent_request_id`, `parent_problem_id`, `parent_change_id`
- Servicesubcategory filter: `WHERE request_type = 'incident'`

---

### 1.6 Change

**DB Table:** `ticket_change` (simple) | `change` (ITIL, abstract)  
**Parent:** Ticket  
**4 Variants:**

| Variant | Table | Type | States |
|---|---|---|---|
| **Simple Change** | `ticket_change` | Concrete | 6: new, rejected, assigned, planned, approved, closed |
| **Routine Change** (ITIL) | `change_routine` | Concrete | 10: skips validation/approval, new→assigned→plannedscheduled→implemented→closed |
| **Normal Change** (ITIL) | `change_normal` | Concrete | 10: full workflow with validation + CAB approval |
| **Emergency Change** (ITIL) | `change_emergency` | Concrete | 10: skips validation, direct approval |

**Shared fields (all Change variants):**

| Field | Type | Notes |
|---|---|---|
| `reason` | Text | Reason for change |
| `requestor_id` | FK → Person | Person requesting the change |
| `creation_date` | DateTime | |
| `impact` | Text | Impact description |
| `supervisor_group_id` | FK → Team | |
| `supervisor_id` | FK → Person | Filtered by team membership |
| `manager_group_id` | FK → Team | CAB/approval group |
| `manager_id` | FK → Person | |
| `outage` | Enum: yes/no | Will this cause outage? |
| `fallback` | Text | Rollback plan |
| `parent_id` | FK → Change (self) | |
| `related_request_list` | LinkedSet → UserRequest | |
| `related_incident_list` | LinkedSet → Incident | |
| `related_problems_list` | LinkedSet → Problem | |

**ApprovedChange (abstract, parent of Normal + Emergency):**

| Field | Type |
|---|---|
| `approval_date` | DateTime |
| `approval_comment` | String |

**NormalChange additional fields:**

| Field | Type |
|---|---|
| `acceptance_date` | DateTime |
| `acceptance_comment` | Text |

---

### 1.7 Problem

**DB Table:** `ticket_problem`  
**Parent:** Ticket

| Field | Type | Notes |
|---|---|---|
| `status` | Enum: `new`, `assigned`, `resolved`, `closed` | |
| `service_id` | FK → Service | |
| `servicesubcategory_id` | FK → ServiceSubcategory | |
| `product` | String | |
| `impact` | Enum: 1-3 | |
| `urgency` | Enum: 1-4 | |
| `priority` | Enum: 1-4 | Computed via matrix |
| `related_change_id` | FK → Change | |
| `assignment_date` | DateTime | |
| `resolution_date` | DateTime | |
| `knownerrors_list` | LinkedSet → KnownError | |
| `related_request_list` | LinkedSet → UserRequest | |
| `related_incident_list` | LinkedSet → Incident | |

**Ref Format:** `P-%06d`

---

### 1.8 WorkOrder

**DB Table:** `workorder`  
**Parent:** `cmdbAbstractObject`

| Field | Type | Required |
|---|---|---|
| `name` | String | Yes |
| `status` | Enum: open, closed | Yes, default=open |
| `description` | Text | Yes |
| `ticket_id` | FK → Ticket | No |
| `team_id` | FK → Team | Yes |
| `agent_id` | FK → Person | No |
| `start_date` | DateTime | Yes |
| `end_date` | DateTime | No |
| `log` | CaseLog | No |

**Lifecycle:** `open → ev_close → closed` (sets end_date)

---

### 1.9 Service / SLA / SLT / Contract

#### Service

**DB Table:** `service`

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | |
| `org_id` | FK → Organization, required | |
| `servicefamily_id` | FK → ServiceFamily | Grouping |
| `description` | Text | |
| `status` | Enum: implementation, production, obsolete | |
| `icon` | Image | |
| `servicesubcategories_list` | LinkedSet → ServiceSubcategory | |

#### ServiceSubcategory

**DB Table:** `servicesubcategory`

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | |
| `description` | Text | |
| `service_id` | FK → Service, required | |
| `request_type` | Enum: incident, service_request | Determines which ticket type |
| `status` | Enum: implementation, production, obsolete | |

#### SLA

**DB Table:** `sla`

| Field | Type |
|---|---|
| `name` | String, required |
| `description` | Text |
| `org_id` | FK → Organization, required |
| `slts_list` | LinkedSetIndirect → SLT via `lnkSLAToSLT` |

#### SLT (Service Level Target)

**DB Table:** `slt`

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | |
| `priority` | Enum: 1-4 | Target applies to this priority |
| `request_type` | Enum: incident, service_request | Target applies to this type |
| `metric` | Enum: tto, ttr | What this target measures |
| `value` | Integer | The target value |
| `unit` | Enum: hours, minutes | Unit for the value |

#### CustomerContract

**DB Table:** `customercontract`  
**Parent:** Contract (abstract)

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | |
| `org_id` | FK → Organization (customer) | |
| `provider_id` | FK → Organization (provider) | |
| `description` | Text | |
| `start_date` | Date | |
| `end_date` | Date | |
| `cost` | String | |
| `cost_currency` | Enum: dollars, euros | |
| `status` | Enum: implementation, production, obsolete | |
| `services_list` | LinkedSetIndirect | Via `lnkCustomerContractToService` |

#### lnkCustomerContractToService

**DB Table:** `lnkcustomercontracttoservice`  
**Is Link:** Yes

| Field | Type |
|---|---|
| `customercontract_id` | FK → CustomerContract |
| `service_id` | FK → Service |
| `sla_id` | FK → SLA (optional, which SLA applies) |

#### lnkSLAToSLT

**DB Table:** `lnkslatoslt`  
**Is Link:** Yes

| Field | Type |
|---|---|
| `sla_id` | FK → SLA |
| `slt_id` | FK → SLT |

---

## 2. CMDB — Configuration Management Database

### 2.1 Class Hierarchy

iTop defines **49 CI classes** across the following hierarchy:

```
cmdbAbstractObject
│
├── FunctionalCI (abstract)
│   │
│   ├── PhysicalDevice (abstract)
│   │   └── ConnectableCI (abstract)
│   │       └── DatacenterDevice (abstract)
│   │           ├── NetworkDevice
│   │           │   ├── Router
│   │           │   ├── Switch
│   │           │   ├── Hub
│   │           │   ├── PatchPanel
│   │           │   └── ... (subtypes via typology)
│   │           └── Server
│   │               ├── TowerServer
│   │               ├── RackServer
│   │               └── BladeServer
│   │
│   ├── PC
│   ├── Printer
│   ├── Tablet
│   ├── Phone
│   ├── MobilePhone
│   │
│   ├── ApplicationSolution (abstract)
│   │   └── BusinessProcess
│   │
│   ├── SoftwareInstance (abstract)
│   │   ├── Middleware
│   │   ├── DBServer
│   │   ├── WebServer
│   │   ├── PCSoftware
│   │   └── OtherSoftware
│   │
│   ├── MiddlewareInstance
│   ├── DatabaseSchema
│   └── WebApplication
│
├── Software (abstract)
│
├── Patch (abstract)
│   ├── OSPatch
│   └── SoftwarePatch
│
├── Licence (abstract)
│   ├── OSLicence
│   └── SoftwareLicence
│
├── Subnet
├── VLAN
├── Group
│
├── NetworkInterface (abstract)
│   └── IPInterface (abstract)
│       └── PhysicalInterface
│
├── FiberChannelInterface
├── SANSwitch
├── StorageSystem
├── NASFileSystem
├── LogicalVolume
├── Tape
├── TapeLibrary
├── Enclosure
├── Rack
├── PowerConnection
├── Container
├── ContainerImage
├── Farm
├── DataFlow
├── ApplicationMonitoring
│
├── Typology (abstract)
│   ├── OSVersion
│   ├── OSFamily
│   ├── Brand
│   ├── Model
│   ├── NetworkDeviceType
│   └── IOSVersion
│
└── (Link tables for relationships)
    ├── lnkFunctionalCIToCI
    ├── lnkFunctionalCIToTicket
    ├── lnkCIRelatedProblem
    ├── lnkCIRelatedIncident
    ├── lnkCIRelatedRequest
    └── lnkCIRelatedChange
```

### 2.2 CI-to-CI Relationships

Key relationship types modeled via link tables:

| Link | Connects |
|---|---|
| `lnkFunctionalCIToCI` | CI-to-CI (impact analysis) |
| `lnkFunctionalCIToTicket` | CI-to-Ticket (which CIs are affected) |
| `lnkCIRelatedProblem` | CI-to-Problem |
| `lnkCIRelatedIncident` | CI-to-Incident |
| `lnkCIRelatedRequest` | CI-to-UserRequest |
| `lnkCIRelatedChange` | CI-to-Change |
| `lnkFunctionalCIToService` | CI-to-Service |

**Impact Analysis:** When a CI is linked to a ticket, `UpdateImpactedItems()` recalculates the `functionalcis_list` to include all connected CIs via the `lnkFunctionalCIToCI` graph, enabling impact propagation.

---

## 3. Lifecycle State Machines

### 3.1 UserRequest — Complete State Machine

**10 States · 12 Stimuli · 20+ Transition Rules**

#### States

| State | Rank | Color | Icon |
|---|---|---|---|
| `new` | 10 | Default | — |
| `waiting_for_approval` | 20 | Warning | hourglass |
| `approved` | 30 | Success | user-check |
| `rejected` | 40 | Failure | user-times |
| `assigned` | 60 | Neutral | — |
| `pending` | 70 | Warning | hourglass |
| `escalated_tto` | 80 | Failure/Fire | fire |
| `escalated_ttr` | 90 | Failure/Fire | fire |
| `resolved` | 100 | Success | check |
| `closed` | 110 | Frozen | — |

#### Stimuli (Events)

| Stimulus ID | Type | User Action? |
|---|---|---|
| `ev_assign` | StimulusUserAction | Yes |
| `ev_reassign` | StimulusUserAction | Yes |
| `ev_approve` | StimulusUserAction | Yes |
| `ev_reject` | StimulusUserAction | Yes |
| `ev_pending` | StimulusUserAction | Yes |
| `ev_resolve` | StimulusUserAction | Yes |
| `ev_close` | StimulusUserAction | Yes |
| `ev_reopen` | StimulusUserAction | Yes |
| `ev_wait_for_approval` | StimulusUserAction | Yes |
| `ev_timeout` | StimulusInternal | No (SLA trigger) |
| `ev_autoresolve` | StimulusInternal | No (cascade) |
| `ev_autoclose` | StimulusInternal | No (scheduled) |

#### Transition Table

| From State | Stimulus | To State | Actions |
|---|---|---|---|
| `new` | `ev_assign` | `assigned` | SetCurrentDate(assignment_date) |
| `new` | `ev_timeout` | `escalated_tto` | (none — SLA timeout) |
| `new` | `ev_wait_for_approval` | `waiting_for_approval` | (none) |
| `new` | `ev_autoresolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `escalated_tto` | `ev_assign` | `assigned` | SetCurrentDate(assignment_date) |
| `escalated_tto` | `ev_autoresolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `assigned` | `ev_pending` | `pending` | SetCurrentDate(last_pending_date) |
| `assigned` | `ev_resolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `assigned` | `ev_reassign` | `assigned` | (same state, new agent — agent_id must change) |
| `assigned` | `ev_timeout` | `escalated_ttr` | (none — SLA timeout) |
| `assigned` | `ev_autoresolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `escalated_ttr` | `ev_pending` | `pending` | SetCurrentDate(last_pending_date) |
| `escalated_ttr` | `ev_resolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `escalated_ttr` | `ev_reassign` | `assigned` | (none) |
| `escalated_ttr` | `ev_autoresolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `waiting_for_approval` | `ev_approve` | `approved` | (none) |
| `waiting_for_approval` | `ev_reject` | `rejected` | (none) |
| `waiting_for_approval` | `ev_autoresolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `approved` | `ev_timeout` | `escalated_tto` | (none) |
| `approved` | `ev_assign` | `assigned` | SetCurrentDate(assignment_date) |
| `approved` | `ev_autoresolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `rejected` | `ev_reopen` | `new` | (none) |
| `pending` | `ev_assign` | `assigned` | (none) |
| `pending` | `ev_autoresolve` | `resolved` | SetCurrentDate(resolution_date), SetElapsedTime(time_spent), ResolveChildTickets |
| `resolved` | `ev_close` | `closed` | SetCurrentDate(close_date) |
| `resolved` | `ev_reopen` | `assigned` | (none) |
| `closed` | *(none)* | *(terminal)* | |

#### State Field Flags

Each state defines which fields are:
- **`hidden`** — not shown in UI
- **`read_only`** — visible but not editable
- **`mandatory`** — must be filled
- **`must_prompt`** — force user interaction
- **(empty)** — normal/editable

For example, in `new` state:
- `org_id` → **mandatory**
- `caller_id` → **mandatory**
- `team_id` → **hidden** (not assigned yet)
- `agent_id` → **hidden**
- `priority` → **read_only** (auto-computed)
- `assignment_date`, `resolution_date`, `close_date` → **hidden**
- `solution`, `resolution_code`, `pending_reason` → **hidden**
- `tto_escalation_deadline` → **read_only**

In `assigned` state (inherits from new + overrides):
- `team_id` → **mandatory, must_prompt, read_only**
- `agent_id` → **mandatory, must_prompt, read_only**
- `assignment_date` → **read_only**
- `tto_escalation_deadline` → **hidden**
- `sla_tto_passed`, `sla_tto_over` → **read_only**
- `ttr_escalation_deadline` → **read_only**

---

### 3.2 Incident — State Machine

**7 States · 9 Stimuli**

Similar to UserRequest but simplified (no approval workflow):

| From | Stimulus | To | Actions |
|---|---|---|---|
| `new` | `ev_assign` | `assigned` | SetCurrentDate(assignment_date) |
| `new` | `ev_timeout` | `escalated_tto` | |
| `new` | `ev_autoresolve` | `resolved` | SetCurrentDate + SetElapsedTime + ResolveChildTickets |
| `escalated_tto` | `ev_assign` | `assigned` | SetCurrentDate(assignment_date) |
| `escalated_tto` | `ev_autoresolve` | `resolved` | SetCurrentDate + SetElapsedTime + ResolveChildTickets |
| `assigned` | `ev_pending` | `pending` | SetCurrentDate(last_pending_date) |
| `assigned` | `ev_resolve` | `resolved` | SetCurrentDate + SetElapsedTime + ResolveChildTickets |
| `assigned` | `ev_reassign` | `assigned` | (agent must change) |
| `assigned` | `ev_timeout` | `escalated_ttr` | |
| `assigned` | `ev_autoresolve` | `resolved` | SetCurrentDate + SetElapsedTime + ResolveChildTickets |
| `escalated_ttr` | `ev_pending` | `pending` | SetCurrentDate(last_pending_date) |
| `escalated_ttr` | `ev_resolve` | `resolved` | SetCurrentDate + SetElapsedTime + ResolveChildTickets |
| `escalated_ttr` | `ev_reassign` | `assigned` | |
| `escalated_ttr` | `ev_autoresolve` | `resolved` | SetCurrentDate + SetElapsedTime + ResolveChildTickets |
| `pending` | `ev_assign` | `assigned` | |
| `pending` | `ev_autoresolve` | `resolved` | SetCurrentDate + SetElapsedTime + ResolveChildTickets |
| `resolved` | `ev_close` | `closed` | SetCurrentDate(close_date) |
| `resolved` | `ev_reopen` | `assigned` | |
| `closed` | *(terminal)* | | |

**Note:** `ev_autoclose` is declared as a stimulus but has no associated transitions in any state.

---

### 3.3 Change — State Machines (4 variants)

#### Simple Change (`itop-change-mgmt`)

```
new ──ev_assign──► assigned ──ev_plan──► planned ──ev_approve──► approved ──ev_finish──► closed
                                             │
                                             └──ev_reject──► rejected ──ev_reopen──► assigned
```

**6 states:** new, rejected, assigned, planned, approved, closed  
**6 stimuli:** ev_assign, ev_plan, ev_reject, ev_reopen, ev_approve, ev_finish

#### Routine Change (ITIL)

```
new ──ev_assign──► assigned ──ev_plan──► plannedscheduled ──ev_implement──► implemented ──ev_monitor──► monitored ──ev_finish──► closed
                                                                                                                                    │
                                                                                                              implemented ──ev_finish──► closed (direct)
```

**Skips:** validation, approval. Good for pre-approved, low-risk changes.

#### Normal Change (ITIL) — Full CAB Workflow

```
new ──ev_validate──► validated ──ev_assign──► assigned ──ev_plan──► plannedscheduled ──ev_approve──► approved ──ev_implement──► implemented ──ev_monitor──► monitored ──ev_finish──► closed
 │                       │                                                                 │                                              │                   │
 │ ev_reject             │                                                                 │ ev_notapprove                                │                   │
 ▼                       │                                                                 ▼                                              │                   │
rejected ◄───────────────┘                                                          notapproved                                           │                   │
 │                                                                                       │                                              │                   │
 └──ev_reopen──► new                                                                     └──ev_replan──► plannedscheduled              │                   │
                                                                                                                                        └───ev_finish───────┘ (direct to closed)
```

**Transition actions:**
- `new → validated`: Reset(reason)
- `plannedscheduled → approved`: SetCurrentDate(approval_date), Reset(reason)
- `implemented → closed`: SetCurrentDate(close_date)
- `monitored → closed`: SetCurrentDate(close_date)

#### Emergency Change (ITIL)

```
new ──ev_assign──► assigned ──ev_plan──► plannedscheduled ──ev_approve──► approved ──ev_implement──► implemented ──ev_monitor──► monitored ──ev_finish──► closed
                                                                 │                                              │                   │
                                                                 │ ev_notapprove                                │                   │
                                                                 ▼                                              │                   │
                                                            notapproved                                       │                   │
                                                                 │                                              │                   │
                                                                 └──ev_replan──► plannedscheduled              │                   │
                                                                                                                └───ev_finish───────┘
```

**Skips:** validation phase (no `ev_validate` stimulus).

---

### 3.4 Problem — State Machine

**4 states · 4 stimuli**

```
new ──ev_assign──► assigned ──ev_resolve──► resolved ──ev_close──► closed
                       │                        │
                       └──ev_reassign──► assigned┘
                                            (reassign within assigned)
```

**Transition actions:**
- `new → assigned`: SetCurrentDate(assignment_date)
- `assigned → resolved`: SetCurrentDate(resolution_date)
- `resolved → closed`: SetCurrentDate(close_date)

---

### 3.5 Transition Actions Reference

| Verb | Effect | Parameters |
|---|---|---|
| `SetCurrentDate` | Sets a date field to current time | `attcode` (target field) |
| `SetCurrentDateIfNull` | Sets a date field only if currently null | `attcode` (target field) |
| `SetElapsedTime` | Computes elapsed working time | `targetAtt`, `startDateAtt`, `timeComputer` (DefaultWorkingTimeComputer) |
| `Reset` | Resets a field to its default value | `attcode` (target field) |
| `Copy` | Copies value from one field to another | `sourceAtt`, `destAtt` |
| `ApplyStimulus` | Programmatically applies another stimulus | `stimulusId` |
| `ResolveChildTickets` | Cascade-resolves all child tickets | (none) |
| `UpdateChildTicketLog` | Syncs public_log entries to child tickets | `childClass`, `childParentAttCode`, `logAttCodes` |

---

## 4. SLA Engine

### 4.1 StopWatch Mechanism

The SLA engine is built on `AttributeStopWatch` — a custom field type that:
1. **Tracks elapsed time** while the ticket is in specified states
2. **Computes deadlines** based on a goal metric computer
3. **Fires threshold actions** at configurable percentages (75%, 100%)
4. **Provides sub-items** for deadline, passed flag, overrun, and time spent

**StopWatch configuration:**
```json
{
  "states": ["new", "escalated_tto", "assigned"],  // When the clock is running
  "working_time": null,                              // Uses DefaultWorkingTimeComputer
  "goal": "ResponseTicketTTO",                      // Metric computer class
  "thresholds": [
    { "id": "75", "highlight": "warning", "actions": [] },
    { "id": "100", "highlight": "critical", "actions": [{ "verb": "ApplyStimulus", "params": ["ev_timeout"] }] }
  ]
}
```

**Sub-items exposed for each StopWatch:**

| SubItem Code | Purpose |
|---|---|
| `timespent` | Time elapsed so far (Duration) |
| `100_deadline` | Absolute deadline DateTime |
| `100_passed` | Boolean: has deadline passed? |
| `100_overrun` | Duration: how far past deadline |

### 4.2 Business Hours Algorithm

The **`DefaultWorkingTimeComputer`** computes working time based on:

1. **Working days:** Monday through Friday
2. **Working hours:** 09:00 to 17:00 (configurable)
3. **Holidays:** Excluded based on a holiday calendar
4. **Algorithm:**
   ```
   function computeDeadline(startDateTime, targetMinutes):
       remainingMinutes = targetMinutes
       currentTime = startDateTime
       
       while remainingMinutes > 0:
           if currentTime is weekend or holiday:
               advance to next working day 09:00
           elif currentTime is before 09:00:
               currentTime = 09:00 same day
           elif currentTime is after 17:00:
               advance to next day 09:00
           else:
               minutesInDay = min(remainingMinutes, 17:00 - currentTime)
               currentTime += minutesInDay
               remainingMinutes -= minutesInDay
               if remainingMinutes > 0:
                   advance to next working day 09:00
       
       return currentTime
   ```

### 4.3 TTO (Time to Own)

| Property | Value |
|---|---|
| **Active States** | `new`, `escalated_tto`, `approved` |
| **Stops When** | Ticket reaches `assigned` state (or resolved/closed) |
| **Goal Metric** | `ResponseTicketTTO` |
| **Threshold at 75%** | Highlight = `warning` |
| **Threshold at 100%** | Highlight = `critical` + `ApplyStimulus(ev_timeout)` → `escalated_tto` |

**Purpose:** Measures how quickly a ticket gets responded to/assigned after creation.

### 4.4 TTR (Time to Resolve)

| Property | Value |
|---|---|
| **Active States** | `new`, `escalated_tto`, `assigned`, `approved`, `escalated_ttr` |
| **Stops When** | Ticket reaches `resolved` state |
| **Goal Metric** | `ResponseTicketTTR` |
| **Threshold at 75%** | Highlight = `warning` |
| **Threshold at 100%** | Highlight = `critical` + `ApplyStimulus(ev_timeout)` → `escalated_ttr` |

**Purpose:** Measures the total time from creation to resolution.

### 4.5 SLT Lookup OQL

The SLT (Service Level Target) is determined by this OQL query:

```sql
SELECT SLT AS slt 
JOIN lnkSLAToSLT AS l1 ON l1.slt_id=slt.id 
JOIN SLA AS sla ON l1.sla_id=sla.id 
JOIN lnkCustomerContractToService AS l2 ON l2.sla_id=sla.id 
JOIN CustomerContract AS sc ON l2.customercontract_id=sc.id 
WHERE slt.metric = :metric                          -- 'tto' or 'ttr'
  AND l2.service_id = :this->service_id              -- Ticket's service
  AND sc.org_id = :this->org_id                      -- Ticket's organization
  AND slt.request_type = :request_type                -- 'incident' or 'service_request'
  AND slt.priority = :this->priority                  -- Ticket's priority (1-4)
```

**Resolution path:** Ticket → Service → CustomerContract → SLA → SLT → target value

---

## 5. Priority Matrix

Priority is computed automatically from **Impact × Urgency**:

```
Priority = matrix[impact][urgency]

Impact levels:
  1 = Organization-wide  (service down, many users affected)
  2 = Group/Department   (multiple users affected)
  3 = Individual         (single user affected)

Urgency levels:
  1 = Critical  (work cannot continue)
  2 = High      (significant disruption)
  3 = Medium    (some disruption)
  4 = Low       (minor issue, workaround exists)
```

**Matrix:**

| Impact \ Urgency | 1 (Critical) | 2 (High) | 3 (Medium) | 4 (Low) |
|---|---|---|---|---|
| **1 (Organization)** | 1 | 1 | 2 | 4 |
| **2 (Group)** | 1 | 2 | 3 | 4 |
| **3 (Individual)** | 2 | 3 | 3 | 4 |

**Priority meanings:**
- **1 (Critical):** Emergency response, immediate action, red highlight
- **2 (High):** Urgent response, orange highlight
- **3 (Medium):** Normal response, blue highlight
- **4 (Low):** Best effort, grey highlight

---

## 6. Email-to-Ticket

### 6.1 Current iTop Implementation

The reference implementation in `webservices/createfrommail.php` is **minimal** and lacks many features of a modern email-to-ticket system:

| Feature | Status |
|---|---|
| Protocol | POP3 only (via PEAR Net_POP3) |
| MIME decoding | PEAR Mail_mimeDecode |
| Subject parsing | **Not implemented** — no `[R-xxxxx]` reference extraction |
| Body extraction | text/plain preferred, fallback to text/html |
| Attachment handling | **Not implemented** — silently ignored |
| Caller lookup | `Contact WHERE email = sender` (exact match, requires exactly 1 result) |
| New ticket creation | Yes — hardcoded defaults for impact/urgency/service |
| Existing ticket update | **Not implemented** — every email creates a new ticket |
| Reply-thread stripping | **Not implemented** — `Re:`, quoted text preserved verbatim |
| Sender extraction | Non-standard regex from `Received` header (fragile) |

**Flow:**
1. Connect to POP3 mailbox
2. For each message:
   a. Parse headers + MIME body
   b. Extract sender name + email from headers
   c. Lookup Contact by email
   d. If exactly 1 match → create new UserRequest with hardcoded defaults
   e. If 0 or >1 matches → skip (error logged)
   f. Delete processed message from mailbox

### 6.2 Desired Enhancement Spec (for PERN Rewrite)

The new email-to-ticket system should support:

| Feature | Implementation |
|---|---|
| Protocol | IMAP (preferred), POP3 fallback |
| Subject regex | `/\[(R\|I\|C\|P)-(\d+)\]/i` to extract ticket ref |
| Existing ticket match | If ref found → append email body to `public_log` |
| New ticket creation | If no ref match → create new ticket of appropriate type |
| Caller lookup | `Person WHERE email = sender` (fuzzy match optional) |
| Reply-thread stripping | Remove `Re:`, `Fw:`, quoted/forwarded text |
| Attachment handling | Save to storage, link to ticket |
| HTML-to-text conversion | Convert HTML body to plain text for description |
| Multiple mailbox support | Configurable per-team/organization mailboxes |

**Email payload format for webhook:**
```json
{
  "from": "employee@company.com",
  "from_name": "John Doe",
  "to": "support@company.com",
  "subject": "Re: [R-000123] Password reset not working",
  "body_plain": "I still cannot reset my password...",
  "body_html": "<html>...",
  "attachments": [
    { "filename": "screenshot.png", "content": "<base64>", "mime_type": "image/png" }
  ]
}
```

**Response format:**
```json
{
  "status": "created|updated|rejected",
  "ticket_ref": "R-000124",
  "ticket_id": 124,
  "reason": "New ticket created from email"
}
```

---

## 7. RBAC — Role-Based Access Control

### 7.1 Profiles & Permissions

iTop defines **12 profiles** with class-group-level permissions:

| Profile ID | Profile Name | Key Permissions |
|---|---|---|
| 117 | **SuperUser** | Full CRUD on everything + all stimuli |
| 3 | **Configuration Manager** | Write/delete on General, Documentation, Configuration; read on everything |
| 4 | **Service Desk Agent** | Write on Ticketing, Incident, UserRequest; read on everything; ev_assign |
| 5 | **Support Agent** | Write + full stimuli on UserRequest (assign, reassign, resolve, close, pending, wait_for_approval) and Incident |
| 6 | **Problem Manager** | Write + stimuli on Problem + KnownError |
| 7 | **Change Implementor** | Plan, implement, monitor changes |
| 8 | **Change Supervisor** | Validate, reject, assign changes |
| 9 | **Change Approver** | Approve/reject changes (CAB role) |
| 10 | **Service Manager** | Write/delete on Service group |
| 11 | **Document Author** | Write/delete on Documentation |
| 2 | **Portal User** | Write on own tickets; ev_close, ev_reopen on UserRequest; read on everything |
| 12 | **Portal Power User** | (empty — placeholder) |

### 7.2 Stimulus-Level Access

Permissions are granular to individual **stimuli** (transition events). For example:

**Support Agent (profile 5) on UserRequest:**
```xml
<action id="ev_assign">allow</action>
<action id="ev_reassign">allow</action>
<action id="ev_resolve">allow</action>
<action id="ev_close">allow</action>
<action id="ev_pending">allow</action>
<action id="ev_wait_for_approval">allow</action>
```

**Portal User (profile 2) on UserRequest:**
```xml
<action id="ev_close">allow</action>
<action id="ev_reopen">allow</action>
```

**This means**: even if the state machine allows a transition, the user must also have stimulus-level permission to execute it.

### Recommended Roles for PERN Rewrite

| Role | Maps to iTop Profile | Permissions |
|---|---|---|
| `ADMIN` | SuperUser (117) | Full system access |
| `AGENT` | Support Agent (5) | Full ticket lifecycle on all types |
| `MANAGER` | Service Manager (10) | Agent + SLA/Service config |
| `CHANGE_MANAGER` | Change Supervisor (8) | Change approvals |
| `USER` | Portal User (2) | Create own tickets, view/comments/close |
| `READ_ONLY` | — | View-only access |

---

## 8. Audit Trail

iTop tracks all changes via:

### Change History Tables

| Table | Purpose |
|---|---|
| `priv_change` | Log entry header (object class, key, date, user) |
| `priv_change_op` | Individual field changes (attcode, oldvalue, newvalue) |

### What Gets Logged

- **State transitions:** `fromStatus` → `toStatus` via stimulus
- **Field changes:** Before/after values for all tracked fields
- **Assignment changes:** `agent_id` and `team_id` changes
- **Comment additions:** Entries to `public_log` and `private_log`
- **CI links:** Add/remove CIs from ticket

### Recommended Audit Schema for PERN Rewrite

```sql
CREATE TABLE audit_trail (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id),
  user_id INTEGER REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,  -- 'transition', 'field_change', 'comment', 'assignment', 'ci_link'
  from_value TEXT,
  to_value TEXT,
  metadata JSONB,  -- stimulus, field name, etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 9. Reference Data: Enum Values

### Origin
`in_person`, `chat`, `mail`, `phone`, `portal`, `monitoring`

### Request Type (UserRequest)
`incident`, `service_request`

### Impact
`1` (Organization-wide), `2` (Group), `3` (Individual)

### Urgency / Priority
`1` (Critical), `2` (High), `3` (Medium), `4` (Low)

### Resolution Code
`assistance`, `other`, `software patch`, `training`, `hardware repair`, `system update`, `bug fixed`

### User Satisfaction
`1` (Very unsatisfied) → `4` (Very satisfied)

### Escalation Flag
`yes`, `no`

### Service Status
`implementation`, `production`, `obsolete`

### SLT Metric
`tto`, `ttr`

### SLT Unit
`hours`, `minutes`

### Change Category (simple)
`hardware`, `software`, `system`, `network`, `application`, `other`

### Change Outage
`yes`, `no`

### Contract Status
`implementation`, `production`, `obsolete`

### Operational Status (MetaEnum — maps to ticket status)
- `ongoing` → [new, assigned, pending, escalated_tto, escalated_ttr, waiting_for_approval, approved]
- `resolved` → [resolved]
- `closed` → [closed, rejected]

---

## Appendix: Instance Management

### Ticket Reference Format

| Class | Format | Example |
|---|---|---|
| Ticket (base) | `T-%06d` | `T-000001` |
| UserRequest | `R-%06d` | `R-000123` |
| Incident | `I-%06d` | `I-000456` |
| Change | `C-%06d` | `C-000789` |
| Problem | `P-%06d` | `P-000321` |

### Key Business Rules

1. **A ticket's ref is auto-generated** on first insert using a counter. The ref is unique per finalclass.
2. **Priority is auto-computed** from impact × urgency on every write.
3. **ServiceSubcategory determines request_type** for UserRequests (`incident` vs `service_request`).
4. **Agent must belong to the assigned team** — validated via OQL filter on `agent_id`.
5. **Caller must belong to the ticket's organization** — validated via OQL filter on `caller_id`.
6. **Parent ticket cannot reference itself** — validated in `DoCheckToWrite`.
7. **Closed tickets are read-only** — all fields become read_only.
8. **Pending requires a reason** — `pending_reason` is mandatory + must_prompt in pending state.
9. **Resolution requires code + solution** — both mandatory + must_prompt in resolved state.
10. **User satisfaction is collected on closure** — mandatory but read_only field in closed state.
