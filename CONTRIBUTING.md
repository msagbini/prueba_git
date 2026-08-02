# Contributing to DOS

This project is built collaboratively by AI and human reviewers under a
strict process. These rules are not optional — they exist because DOS is
being built as a real, sellable product, not a prototype.

## Build rules

1. **No code before architecture.** A module's schema, API contract and data
   model must be defined and documented before its business logic is
   implemented.
2. **No phase advances without human approval.** Each phase in the roadmap
   (see root `README.md` and `docs/technical-log/`) ends with an explicit
   sign-off before the next one starts.
3. **No invented fields or tables.** Every column and table must trace back
   to a documented requirement. If you're unsure whether a field is needed,
   ask — don't add it speculatively.
4. **No placeholders or half-finished implementations.** A stubbed contract
   (e.g. a controller that throws `NotImplementedException` while its
   feature phase hasn't started) is acceptable and documented as such; silent
   dead code is not.
5. **Document as you build**, not after:
   - Every module has a `README.md`.
   - Every exported function has a doc comment (enforced by
     `eslint-plugin-jsdoc`, see `packages/config`).
   - Non-obvious logic gets a short comment explaining _why_, not _what_.
   - Every phase gets an entry in `docs/technical-log/`.
   - Every non-trivial architectural decision gets an ADR in `docs/adr/`.

## Workflow

1. Create a branch off the current development branch.
2. Make focused commits with descriptive messages (imperative mood, e.g.
   `Add organization_memberships table and RLS policy`).
3. Run `pnpm turbo run lint build test` before pushing.
4. Open a PR; CI must pass, including the documentation-presence check.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), enforced by
commitlint via a Husky `commit-msg` hook.

## Monorepo commands

- `pnpm dev` — run all apps in development mode.
- `pnpm build` — build all apps and packages.
- `pnpm lint` — lint the whole monorepo.
- `pnpm test` — run all test suites.
- `pnpm docs:api` — regenerate `docs/api/openapi.yaml` from the API's
  Swagger decorators.
- `pnpm docs:check-readmes` — verify every app/module has a required README.
