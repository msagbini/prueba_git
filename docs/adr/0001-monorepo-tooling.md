# ADR 0001: pnpm workspaces + Turborepo for the monorepo

- **Status**: Accepted
- **Date**: Fase 2

## Context

DOS is built as three deployable apps (`api`, `web`, `mobile`) sharing
type contracts and tooling config. We need a monorepo tool that can
orchestrate `lint`/`build`/`test` across them with caching, without
imposing a heavy framework on a project that is still small (3 apps, 2
shared packages).

## Decision

Use **pnpm workspaces** for dependency management and **Turborepo** for
task orchestration/caching.

## Alternatives considered

- **Nx**: more powerful (generators, dependency graph visualization,
  distributed caching out of the box) but imposes its own plugin/generator
  model and a steeper learning curve than this project's current size
  justifies.
- **Plain npm/yarn workspaces without a task runner**: works for dependency
  linking but leaves `turbo run build` (run `build` in every package that
  has one, in dependency order, with caching) to be reimplemented by hand
  or via ad hoc shell scripts.

## Consequences

- pnpm's strict `node_modules` (no phantom dependencies) matters for a
  project with an explicit "every dependency must be intentional"
  documentation culture, and its content-addressable store keeps
  `apps/mobile`'s heavy native dependencies from bloating disk usage
  across packages.
- Turborepo is a thin layer; if the project outgrows it (e.g. needs
  distributed remote caching across a larger team, code generators), a
  later migration to Nx remains straightforward since workspace layout
  doesn't change.
