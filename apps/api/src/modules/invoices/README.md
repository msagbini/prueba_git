# modules/invoices

Invoices and their line items. `subtotal`/`total` are derived from line
items (recomputed on every `POST .../line-items` call) rather than set
directly. `taxAmount` stays `0` — there's no rate/rule anywhere in the
schema to compute it from. `invoiceNumber` (e.g. `INV-0001`) is generated
per organization on create.

| Method & path                   | Auth                        | Notes                                   |
| ------------------------------- | --------------------------- | --------------------------------------- |
| `GET /invoices`                 | Required, `invoices.read`   | Client role: own invoices only          |
| `POST /invoices`                | Required, `invoices.manage` | Audit-logged                            |
| `GET /invoices/:id`             | Required, `invoices.read`   | Same row-level visibility as list       |
| `PATCH /invoices/:id`           | Required, `invoices.manage` | Audit-logged                            |
| `POST /invoices/:id/line-items` | Required, `invoices.manage` | Recomputes subtotal/total, audit-logged |
