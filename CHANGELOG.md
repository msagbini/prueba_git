# Changelog

All notable changes to this project are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
