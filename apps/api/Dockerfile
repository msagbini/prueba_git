# Production image for apps/api. Built from the monorepo root (see the
# `docker build -f apps/api/Dockerfile .` invocation in CI/README) since
# a pnpm workspace's lockfile encodes the whole workspace graph — `pnpm
# install` needs every package.json in the workspace present, not just
# apps/api's.
#
# Base image: `node:22-slim` (Debian/glibc), not `node:22-alpine` (musl).
# argon2 (see docs/architecture/auth.md) ships prebuilt native binaries
# for both glibc and musl on linux-x64/arm64 — confirmed by inspecting
# `node_modules/argon2/prebuilds/` after a real `pnpm deploy --prod`
# in this project's own (glibc) environment, where a hash/verify round
# trip against the deployed package was also run directly and passed.
# Only the glibc path has actually been exercised, though (every
# signup/login in this project's e2e suite runs on it) — slim keeps the
# deploy target matching what's verified rather than introducing musl,
# an entirely separate native-addon compatibility surface, on top of a
# container build this sandbox couldn't run at all (Docker Hub pulls
# are blocked by egress policy here — see docs/technical-log/phase-7.md).

FROM node:22-slim AS base
# Pinned to the exact version declared in the root package.json's
# "packageManager" field, so the image always builds with the same pnpm
# the lockfile was generated with.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS build
# argon2 ships prebuilt binaries (see the base-image note above) and
# doesn't need this, but a C++ toolchain is kept for `pnpm install` in
# case any other native dependency ever needs to build from source —
# cheap insurance in a build-only stage that never reaches the runtime image.
RUN apt-get update && apt-get install --no-install-recommends -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dos/api prisma:generate
RUN pnpm --filter @dos/api build
# `pnpm deploy` (not `cp`/manual copying) produces a self-contained,
# production-only install for one workspace package — the officially
# supported way to extract a single app from a pnpm monorepo for a
# container image, resolving the workspace `catalog:`/`workspace:*`
# dependency specifiers pnpm itself understands rather than reinventing
# that resolution by hand. `--legacy`: pnpm v10 otherwise refuses to
# deploy from a workspace without `inject-workspace-packages=true` set;
# apps/api's only workspace dependency (`@dos/config`) is dev-only and
# already dropped by `--prod`, so there is nothing for the non-legacy
# (symlink-injecting) implementation to buy here.
RUN pnpm --filter @dos/api deploy --legacy --prod /out/api

FROM node:22-slim AS runtime
# dumb-init: Node doesn't reap zombie processes or forward signals
# correctly as PID 1 — without it, `docker stop`/a Kubernetes
# preStop/SIGTERM can hang until the grace period expires instead of
# triggering the graceful-shutdown path (main.ts's `app.enableShutdownHooks()`).
RUN apt-get update && apt-get install --no-install-recommends -y dumb-init \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
# `pnpm deploy` copies the package's current directory content (not just
# node_modules) — `dist/` is already built by the time it runs above, so
# it's included in /out/api; no separate copy of it is needed here.
COPY --from=build /out/api ./
RUN groupadd -r dos && useradd -r -g dos dos
USER dos
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
