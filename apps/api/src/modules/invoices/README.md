# modules/invoices

Invoices and their line items. `subtotal`/`taxAmount`/`total` are
derived from line items rather than set directly — computing them is
Fase 3 business logic.

**Fase 2 scope**: contract only — see `invoices.service.ts` and root
`CONTRIBUTING.md`.

| Method & path                   | Auth     | Notes                                  |
| ------------------------------- | -------- | -------------------------------------- |
| `GET /invoices`                 | Required | Scoped to own invoices for Client role |
| `POST /invoices`                | Required |                                        |
| `GET /invoices/:id`             | Required |                                        |
| `PATCH /invoices/:id`           | Required |                                        |
| `POST /invoices/:id/line-items` | Required |                                        |
