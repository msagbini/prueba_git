# modules/services

The service catalog: categories and priced, sellable services (hourly,
fixed, or per-unit — see `PricingType` in schema.prisma).

**Fase 2 scope**: contract only — see `services.service.ts` and root
`CONTRIBUTING.md`.

| Method & path              | Auth     | Notes |
| -------------------------- | -------- | ----- |
| `GET /service-categories`  | Required |       |
| `POST /service-categories` | Required |       |
| `GET /services`            | Required |       |
| `POST /services`           | Required |       |
| `GET /services/:id`        | Required |       |
| `PATCH /services/:id`      | Required |       |
| `DELETE /services/:id`     | Required |       |
