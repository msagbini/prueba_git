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
  App.tsx               Routing shell: /login, and a protected layout route
                        (/ dashboard, /billing) behind RequireAuth
  context/
    AuthContext.tsx      In-memory access-token state; restores a session
                         on boot via a silent POST /auth/refresh (relies on
                         the httpOnly refresh cookie), login()/logout()
  layouts/
    AppLayout.tsx          Header nav (Dashboard/Billing) + sign-out, wraps
                           the authenticated routes via <Outlet/>
  api/
    client.ts             Typed fetch wrapper — attaches the access token,
                          sends credentials for the httpOnly refresh cookie
  pages/
    LoginPage.tsx           Functional login form
    DashboardPage.tsx        Landing screen (operational screens — clients,
                             jobs, scheduling, staff — land in a later phase)
    BillingPage.tsx           Current plan + Free/Pro/Business tiles, Stripe
                              Checkout upgrade flow, and the checkout
                              success/canceled redirect banners (Fase 8)
  types/
    api.ts                  Shared response types for the billing endpoints
```

## Billing (Fase 8)

`BillingPage` is a real consumer of the `modules/billing` API built in
Fase 4 (`GET /organizations/me/subscription`, `GET /plans`,
`POST /organizations/me/subscription/checkout`). Upgrading redirects to
Stripe Checkout; `STRIPE_CHECKOUT_SUCCESS_URL`/`_CANCEL_URL` (see
`apps/api/.env.example`) point back at `/billing?checkout=success|canceled`,
which this same page renders as a dismissible banner. A 503 from the
checkout endpoint (no Stripe credentials configured on the deployment) is
shown inline rather than treated as a generic error.

Not covered: a real end-to-end Stripe payment (no live Stripe test
credentials exist in this project — same limitation documented for the
Fase 4 checkout/webhook work).

## Scripts

- `pnpm dev` — start the Vite dev server.
- `pnpm build` — type-check and production build.
- `pnpm lint` — lint this app.
- `pnpm test` — run the Vitest suite (`jsdom`, `@testing-library/react`).
