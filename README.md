# Multi-Tenant SaaS Starter Kit

A production-oriented SaaS starter project demonstrating:

- Authentication (Local & Google OAuth)
- Multi-tenancy
- Role-based access control (OWNER, MEMBER)
- Organization management
- Invitations
- Subscription billing (Stripe Integration)
- Audit logging
- PostgreSQL row-level security (RLS)
- Redis
- Docker

## Architecture

The system consists of:

- **Frontend**: Next.js (App Router, React Server Components)
- **Backend**: Fastify (Node.js API)
- **Database**: PostgreSQL (Prisma ORM)
- **Cache**: Redis
- **Payments**: Stripe
- **Infrastructure**: Docker

## Status

### Phase 0-8: Foundation & Backend Services
- [x] Repository initialized
- [x] Frontend scaffolded
- [x] Backend scaffolded
- [x] Database Configuration & RLS
- [x] Authentication & Session Management
- [x] Multi-tenancy Isolation
- [x] RBAC (Role-Based Access Control)
- [x] Invitations & Member Management
- [x] Audit Logging
- [x] Google SSO Authentication integration

### Phase 9: Workspace & Billing
- [x] SaaS Workspace Shell (Sidebar, Navigation)
- [x] Organization Settings
- [x] Team Management
- [x] Billing Backend (Usage Sync & Subscriptions)
- [x] Billing Frontend (Subscription display, Stripe Checkout & Portal integration)

### Phase 10: Projects Workspace
- [x] Projects Foundation
- [x] Project Creation
- [x] Project Detail Views
- [x] Project Editing & Deletion
- [x] Full Security Verification (Tenant Isolation, Role Symmetry)

### Security Nuance
*Note: The exact HTTP response for a cross-tenant lookup depends on which security gate is reached. A spoofed organization ID can produce a `403` at the API validation layer (`verifyTenantAccess`); however, a request operating within an authorized tenant context but targeting a record outside the tenant will be hidden by PostgreSQL RLS and surface as a `404`. These represent defense-in-depth enforcement layers.*
