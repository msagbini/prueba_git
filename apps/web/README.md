# @dos/web

The DOS admin dashboard and (eventually) client portal — a React SPA
built with Vite, TypeScript and Tailwind CSS (no component library, per
the product's UI decisions — see the Fase 1 planning discussion in
`docs/technical-log/phase-2.md`).

## Getting started

```bash
cp .env.example .env
pnpm dev
```

Open http://localhost:5173. Requires `apps/api` running (see its own
README) at the URL configured in `VITE_API_URL`.

## Structure

```
src/
  main.tsx            Entry point — mounts <App /> inside a BrowserRouter
  App.tsx               Routing shell: /login and a protected / (dashboard)
  context/
    AuthContext.tsx      In-memory access-token state, login()/logout()
  api/
    client.ts             Typed fetch wrapper — attaches the access token,
                          sends credentials for the httpOnly refresh cookie
  pages/
    LoginPage.tsx           Functional login form
    DashboardPage.tsx        Placeholder landing screen
```

## Fase 2 scope note

This is a routing + API-client **scaffold**, not the finished product —
per the roadmap, real screens for clients/jobs/scheduling/staff/billing
land in Fase 5 (UX/UI work), and session persistence across page reloads,
multi-organization selection UI, and refresh-on-401 resilience are called
out as deferred in the relevant files' doc comments.

## Scripts

- `pnpm dev` — start the Vite dev server.
- `pnpm build` — type-check and production build.
- `pnpm lint` — lint this app.
