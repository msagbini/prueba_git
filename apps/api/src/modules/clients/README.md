# modules/clients

Client (customer) records and their service/billing addresses.

`DELETE /clients/:id` soft-deletes (`deletedAt`) rather than deleting the
row — a client's history (jobs, invoices) must stay attributable.

| Method & path                 | Auth                       | Notes                     |
| ----------------------------- | -------------------------- | ------------------------- |
| `GET /clients`                | Required, `clients.read`   | Excludes soft-deleted     |
| `POST /clients`               | Required, `clients.manage` | Audit-logged              |
| `GET /clients/:id`            | Required, `clients.read`   |                           |
| `PATCH /clients/:id`          | Required, `clients.manage` | Audit-logged              |
| `DELETE /clients/:id`         | Required, `clients.manage` | Soft-delete, audit-logged |
| `GET /clients/:id/addresses`  | Required, `clients.read`   |                           |
| `POST /clients/:id/addresses` | Required, `clients.manage` | Audit-logged              |
