# vaics — ITSM Platform

A full-stack IT Service Management platform built on the PERN stack (PostgreSQL, Express, React, Node.js), modeled after Combodo iTop.

## Features

### Ticket Management
- **4 ticket types** — Incidents, Service Requests, Changes, Problems with distinct lifecycle state machines
- **Kanban dashboard** — visual board to drag tickets through statuses
- **Priority matrix** — auto-computes priority from impact x urgency (iTop-standard)
- **State machine engine** — role-gated transitions per ticket type

### CMDB (Configuration Management Database)
- **Single-table CI** — supports all 49 iTop CI types via JSON attributes
- **Relationship graph** — interactive vis-network visualization of CI dependencies
- **Impact analysis** — see what CIs and tickets are affected by a CI change

### SLA Engine
- **Business hours** — configurable working days, start/end hours per SLA
- **TTO/TTR deadlines** — auto-computed on ticket creation via contract→service→SLA chain
- **Overdue detection** — real-time SLA breach indicators

### Communication & Collaboration
- **Public/private comments** — per-entry visibility control
- **Work orders** — sub-tasks assigned to agents
- **Approval workflows** — request/respond approval chain
- **Audit trail** — full state/field change history

### Email-to-Ticket
- **IMAP polling** — reads inbox, detects ticket refs (`INC-xxxxx`, `SR-xxxxx`, etc.)
- **Auto-create** — new tickets from emails without a ref
- **Auto-comment** — adds email as comment on existing tickets

### User Management & RBAC
- **6 roles** — Admin, Agent, Manager, Change Manager, User, Read-Only
- **JWT authentication** — 24h token-based sessions
- **Organization-scoped** — multi-tenant ready

### Integrations
- **Webhooks** — outbound HTTP callbacks on ticket events
- **REST API** — full JSON API for all entities
- **Reports** — agent performance, SLA compliance, resolution times

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 16+ |
| ORM | Prisma 5 |
| Backend | Express.js, Node 22+ |
| Frontend | React 19, Vite 8, React Router 6 |
| Auth | JWT + bcryptjs |
| Validation | Joi |
| Visualization | vis-network |
| Email | imap + mailparser |

## Project Structure

```
vaics-itsm/
├── server/
│   ├── prisma/
│   │   ├── schema.prisma    # 22 models, 9 enums
│   │   └── seed.js           # default users seed
│   ├── src/
│   │   ├── config/           # constants, state machines (4 types)
│   │   ├── middleware/       # auth, rbac, validate, errorHandler
│   │   ├── services/         # stateMachine, slaCalculator, slaChain,
│   │   │                     # priorityMatrix, ticketRefGen, emailInbound
│   │   └── routes/           # 17 route modules
│   └── .env                  # DATABASE_URL, JWT_SECRET, EMAIL_*
│
├── client/
│   ├── src/
│   │   ├── api/              # 10 API modules
│   │   ├── components/       # Layout, ProtectedRoute, CIGraph
│   │   ├── contexts/         # AuthContext
│   │   └── pages/            # 15 page components
│   └── index.css             # Dark glassmorphism theme
│
└── package.json              # Root scripts
```

## Quick Start

### Prerequisites
- Node.js 22+
- PostgreSQL 16+

### Installation

```bash
# Clone
git clone https://github.com/abhijithwinddaa/ITSM.git
cd ITSM

# Install dependencies
cd server && npm install
cd ../client && npm install
cd ..

# Configure database
# Edit server/.env - set your DATABASE_URL
# Example: postgresql://postgres:password@localhost:5432/vaics_itsm?schema=public

# Generate Prisma client & create tables
cd server
npx prisma generate
npx prisma db push
npx prisma db seed          # creates admin/agent/user accounts

# Run (starts Express :4000 + Vite :5173)
cd ..
npm run dev
```

### Default Accounts

| Role | Login | Password |
|------|-------|----------|
| Admin | `admin` | `admin123` |
| Agent | `agent1` | `agent123` |
| User | `user1` | `user123` |

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Login |
| `GET /api/tickets` | List tickets (filter, search, paginate) |
| `POST /api/tickets` | Create ticket (auto-computes priority + SLA) |
| `GET /api/tickets/:id` | Ticket detail with relations |
| `PATCH /api/tickets/:id/transition` | State machine transition |
| `PATCH /api/tickets/:id/assign` | Assign agent |
| `GET/POST /api/comments/:ticketId` | Ticket comments |
| `GET/POST /api/approvals` | Approval requests |
| `GET/POST /api/ci` | CMDB items |
| `GET /api/ci/:id/impact` | CI impact analysis |
| `GET /api/stats` | Dashboard statistics |
| `GET /api/reports/*` | Agent performance, resolution times |
| `GET/POST /api/webhooks` | Webhook configuration |
| `GET/PUT /api/email-config` | Email settings |

See route files in `server/src/routes/` for full request/response schemas.

## Configuration

### Environment Variables (`server/.env`)

```
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
EMAIL_IMAP_HOST="imap.example.com"
EMAIL_IMAP_USER="support@..."
EMAIL_IMAP_PASS="..."
EMAIL_IMAP_PORT=993
```

### Email-to-Ticket

Emails are scanned for ref patterns `(INC|SR|CHG|PRB)-\d{5}`:
- **With ref** → adds email content as a comment on the matching ticket
- **Without ref** → creates a new ticket (type detected from subject keywords)

## License

MIT
