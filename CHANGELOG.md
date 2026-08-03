# Changelog

All notable changes to this project are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — Fase 3: MVP operativo

- Real implementations for all 11 business modules (organizations,
  memberships, users, clients, services, staff, jobs, invoices, payments,
  audit logs), replacing the Fase 2 `NotImplementedException` stubs.
- Fine-grained `clients.manage`/`clients.read`-style permission guards on
  every business route, on top of the RBAC matrix seeded in Fase 2.
- Row-level visibility: Staff callers see only jobs they're assigned to;
  Client callers see only their own jobs, invoices and payments.
- Automatic invoice numbering, derived invoice totals from line items,
  and automatic invoice-to-PAID transition once payments cover the total.
- An audit trail: every mutation across the business modules records a
  before/after entry, readable via `GET /audit-logs`.
- A `UserInvitation.clientId` link (migration
  `invitation_client_link`) so a Client-role invitation attaches the
  resulting membership to the right `Client` record.

See `docs/technical-log/phase-3.md` for the detailed build log,
including the real bugs found and fixed along the way.

### Added — Fase 2: Base técnica

- Monorepo scaffolding (pnpm workspaces + Turborepo).
- Shared ESLint/Prettier/TypeScript configuration with enforced JSDoc rules.
- Architecture documentation, ADRs and ERD.
- NestJS API scaffold with health check and Swagger.
- PostgreSQL schema (Prisma) covering identity, tenancy and core business
  entities, with Row-Level Security multi-tenant isolation.
- Custom authentication (signup, login, refresh rotation, multi-organization
  switching, invitations) and RBAC guards.
- Business module contract skeletons (organizations, memberships, users,
  clients, services, jobs, staff, invoices, payments, audit logs).
- React SPA scaffold (`apps/web`) and React Native scaffold (`apps/mobile`).
- CI pipeline (lint, build, test, documentation check).

See `docs/technical-log/phase-2.md` for the detailed build log of this phase.
