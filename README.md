# Multi-Tenant SaaS Starter Kit

A production-ready, full-stack B2B Multi-Tenant Software-as-a-Service (SaaS) starter template built with Next.js, Fastify, Prisma, PostgreSQL (with Row-Level Security), and Stripe.

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                            Frontend (Next.js 16)                             │
│       React Server Components • TailwindCSS v4 • Radix UI • Lucide Icons     │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ HTTP / HttpOnly Cookie (port 3000)
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             Backend (Fastify 5)                              │
│       TypeScript • Zod Validation • Centralized RBAC • Raw Body Webhooks     │
└───────┬──────────────────────────────┬───────────────────────────────┬───────┘
        │                              │                               │
        ▼                              ▼                               ▼
┌───────────────┐              ┌───────────────┐              ┌────────────────┐
│  PostgreSQL   │              │     Stripe    │              │  Google OAuth  │
│  (Prisma +    │              │ Subscriptions │              │ Single Sign-On │
│  Native RLS)  │              │ Usage Meters  │              │ (PKCE & OIDC)  │
└───────────────┘              └───────────────┘              └────────────────┘
```

The system employs a strict multi-tenant boundary where an **Organization** acts as the workspace root. Tenant isolation is enforced defense-in-depth across two layers:
1. **Application Layer (Fastify + RBAC)**: Every request validates membership and authorization (`OWNER` vs. `MEMBER`) before issuing queries.
2. **Database Layer (PostgreSQL Row-Level Security)**: Multi-tenant operations run within a transaction with `SET LOCAL ROLE app_user` and `set_config('app.current_tenant_id', ...)` or `set_config('app.current_user_id', ...)`. Even if application checks were bypassed, PostgreSQL RLS policies reject cross-tenant reads and writes.

---

## Key Features

- **Multi-Tenancy & Workspace Management**:
  - Full workspace lifecycle: create workspaces, switch contexts seamlessly, and update workspace details.
  - **Permanent Workspace Deletion**: Owner-only Danger Zone with exact typed workspace name confirmation. Atomic transaction cascade removes all child resources (`Projects`, memberships, invitations, usage, feature flags, audit logs) and automatically cancels active Stripe subscriptions.
  - Dynamic workspace switcher updates and smart ejection handling (navigates to the next available workspace or workspace selection upon deletion/revocation).

- **Authentication & Security**:
  - Email & password authentication with secure password hashing (`argon2`).
  - Google Single Sign-On (SSO) with PKCE code verification and OIDC identity linking.
  - HttpOnly, `SameSite=Lax` secure session cookies.
  - Centralized Role-Based Access Control (`OWNER`, `MEMBER`).

- **Project Management**:
  - Tenant-isolated project workspace creation, listing, updating, and deletion (`Projects`).
  - Automatic PostgreSQL RLS scoping per organization.
  - Immutable audit logging on all project mutations.

- **Team Members & Invitations**:
  - Invite team members by email with cryptographic token hashing and expiration tracking.
  - Public invitation token verification endpoint (`GET /invitations/verify`).
  - In-app accept and decline workflows.
  - Member removal and invitation revocation by workspace owners.

- **Global Notification System**:
  - Unified notification bell dropdown in the authenticated shell with live unread counts.
  - Comprehensive `/notifications` history feed with cursor-based pagination and filter tabs (All vs. Unread).
  - Preserves user-owned notifications across invitation and workspace lifecycles (`onDelete: SetNull`).
  - Actionable inline invitation accept/decline cards directly within notification feeds.

- **Subscriptions & Usage-Based Billing**:
  - Stripe Checkout and Customer Billing Portal integrations.
  - Real-time usage event ingestion and idempotent metered billing synchronization.
  - Webhook signature validation (`fastify-raw-body`) for Stripe customer and subscription events.

- **Audit Logging & Feature Flags**:
  - Organization-scoped audit log timeline for tracking administrative actions.
  - Database trigger protection preventing modification of historical audit records (`prevent_audit_log_mutation`).
  - Dynamic organization-level feature flag evaluation and toggle management.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router, Server Components), [React 19](https://react.dev/), [TailwindCSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), Lucide Icons, Recharts |
| **Backend** | [Fastify 5](https://fastify.dev/), Node.js 22 LTS, TypeScript 7, [Zod](https://zod.dev/) |
| **Database & ORM** | [PostgreSQL 15+](https://www.postgresql.org/), [Prisma ORM 7](https://www.prisma.io/) with `@prisma/adapter-pg` |
| **Security & RLS** | PostgreSQL Native Row-Level Security (`app_user` role, session settings) |
| **Billing & Auth** | [Stripe SDK](https://stripe.com/), [Google Auth Library](https://github.com/googleapis/google-auth-library-nodejs), [Argon2](https://github.com/ranisalt/node-argon2) |
| **Testing** | [Vitest](https://vitest.dev/), Supertest |
| **DevOps & Containers**| Docker, Docker Compose, GitHub Actions CI |

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x` (v22 recommended)
- **Package Manager**: `npm` (v10+)
- **Database**: PostgreSQL 15+ (local installation or Docker)
- **Stripe CLI** *(optional, for testing local webhooks)*: [Stripe CLI](https://stripe.com/docs/stripe-cli)

---

## Environment Variables

The project uses separate `.env` files for the API and Web applications. Sample templates are available in [apps/api/.env.example](file:///c:/Side%20Projects/Software%20Engineering%20Full%20Stack%20Development/Multi%20Tenant%20SaaS%20Starter%20Kit/multi-tenant-saas-starter/apps/api/.env.example) and [apps/web/.env.example](file:///c:/Side%20Projects/Software%20Engineering%20Full%20Stack%20Development/Multi%20Tenant%20SaaS%20Starter%20Kit/multi-tenant-saas-starter/apps/web/.env.example).

### Backend (`apps/api/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/saas_starter?schema=public` |
| `FRONTEND_URL` | Base URL of web client for CORS and redirects | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe secret API key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_PRICE_PRO` | Stripe Price ID for Pro plan checkout | `price_...` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL | `http://localhost:4000/auth/sso/google/callback` |

### Frontend (`apps/web/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of the Fastify API | `http://localhost:4000` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_...` |

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd multi-tenant-saas-starter
```

### 2. Start PostgreSQL via Docker
```bash
docker compose up -d
```
*This starts a local PostgreSQL 15 container listening on port `5432` with database `saas_starter`.*

### 3. Configure Backend Environment & Database
```bash
cd apps/api
cp .env.example .env
npm install

# Run database setup to configure the app_user role for PostgreSQL RLS
npm run db:setup

# Apply Prisma database migrations
npx prisma migrate dev
```

### 4. Configure Frontend Environment
```bash
cd ../web
cp .env.example .env
npm install
```

---

## Running the Application

### Development Mode

Start the backend and frontend in separate terminals:

**Terminal 1 — Backend API (port 4000):**
```bash
cd apps/api
npm run dev
```

**Terminal 2 — Frontend Web (port 3000):**
```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Stripe Webhook Forwarding (Optional)
If testing Stripe billing features locally:
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

---

## Available Scripts & Commands

### Backend API (`apps/api`)

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts API development server with auto-reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript into `dist/` and patches ESM client references |
| `npm start` | Runs the compiled production server (`node dist/server.js`) |
| `npm run db:setup` | Provisions `app_user` database role and permissions for PostgreSQL RLS |
| `npm test` | Runs complete automated test suite with Vitest (`vitest run`) |
| `npm run test:watch` | Runs Vitest in interactive watch mode |
| `npx prisma studio` | Launches Prisma database visualizer UI |

### Frontend Web (`apps/web`)

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles production Next.js standalone application |
| `npm start` | Starts Next.js production server |
| `npm run lint` | Runs ESLint check across frontend source files |

---

## Testing & Quality Assurance

The backend includes a comprehensive automated test suite covering authentication, RBAC, tenant isolation, Row-Level Security, invitations, notifications, and workspace deletion:

```bash
cd apps/api
npm test
```

### Key Security Invariants Tested
- **Row-Level Security (RLS)**: Direct database queries executed under `app_user` cannot access data belonging to other tenants.
- **Cross-Tenant Access Protection**: Requests attempting to specify or modify resources in foreign organizations return `403 Forbidden` or `404 Not Found`.
- **RBAC Symmetry**: Destructive administrative actions (e.g., workspace deletion, member removal) strictly require the `OWNER` role; `MEMBER` attempts return `403`.
- **Transaction-Scoped Audit Log Bypass**: Database trigger `prevent_audit_log_mutation` permits audit record cascade strictly during authorized organization deletion when `app.allow_organization_deletion = 'true'`.

---

## Project Structure

```text
multi-tenant-saas-starter/
├── apps/
│   ├── api/                           # Fastify API Server
│   │   ├── prisma/                    # Prisma Schema & SQL Migrations
│   │   │   ├── migrations/            # Version-controlled migrations (RLS, schema)
│   │   │   └── schema.prisma          # Authoritative data model
│   │   ├── scripts/                   # Database provisioning scripts
│   │   ├── src/
│   │   │   ├── audit/                 # Audit logging service & routes
│   │   │   ├── auth/                  # Local auth, sessions, cookies, and SSO
│   │   │   ├── billing/               # Stripe checkout, portal, usage meters
│   │   │   ├── feature-flags/         # Dynamic feature flag routes & service
│   │   │   ├── invitations/           # Invitation tokens & verification
│   │   │   ├── members/               # Organization membership & roles
│   │   │   ├── notifications/         # Notification feeds & lifecycle service
│   │   │   ├── organizations/         # Workspace CRUD & cascade deletion
│   │   │   ├── projects/              # Projects CRUD & tenant scoping
│   │   │   ├── stripe/                # Stripe SDK client & webhook handling
│   │   │   ├── db.ts                  # Prisma Client & RLS extension setup
│   │   │   ├── app.ts                 # Fastify app factory & error handler
│   │   │   └── server.ts              # Server startup & graceful shutdown
│   │   ├── tests/                     # 13+ Vitest test suites (113+ tests)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                           # Next.js 16 Web Application
│       ├── public/                    # Static assets
│       ├── src/
│       │   ├── app/                   # App Router pages & API handlers
│       │   │   ├── invitations/       # Public accept & redirect pages
│       │   │   ├── login/ & signup/   # Authentication pages
│       │   │   ├── notifications/     # Unified notification history page
│       │   │   └── organizations/     # Workspace dashboard, projects, team,
│       │   │                          # billing, audit logs, feature flags, settings
│       │   ├── components/            # UI components (Radix, Tailwind, modals)
│       │   └── lib/                   # Client utilities, auth, api fetch wrappers
│       ├── package.json
│       └── next.config.ts
│
├── docker-compose.yml                 # PostgreSQL container definition
└── README.md                          # Project documentation
```

---

## License

This project is licensed under the ISC License.
