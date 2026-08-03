# modules/services

The service catalog: categories and priced, sellable services (hourly,
fixed, or per-unit — see `PricingType` in schema.prisma).

`DELETE /services/:id` deactivates (`isActive: false`) rather than
deleting — `Service` has no `deletedAt`, and historical `JobService`/
`InvoiceLineItem` rows reference a service by id. `pricingType: PER_UNIT`
requires a non-empty `unitLabel` on create/update (400 otherwise).

| Method & path              | Auth                        | Notes                    |
| -------------------------- | --------------------------- | ------------------------ |
| `GET /service-categories`  | Required, `services.read`   |                          |
| `POST /service-categories` | Required, `services.manage` | Audit-logged             |
| `GET /services`            | Required, `services.read`   |                          |
| `POST /services`           | Required, `services.manage` | Audit-logged             |
| `GET /services/:id`        | Required, `services.read`   |                          |
| `PATCH /services/:id`      | Required, `services.manage` | Audit-logged             |
| `DELETE /services/:id`     | Required, `services.manage` | Deactivate, audit-logged |
