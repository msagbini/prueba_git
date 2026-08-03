# modules/clients

Client (customer) records and their service/billing addresses.

**Fase 2 scope**: contract only — see `clients.service.ts` and root
`CONTRIBUTING.md`.

| Method & path                 | Auth     | Notes |
| ----------------------------- | -------- | ----- |
| `GET /clients`                | Required |       |
| `POST /clients`               | Required |       |
| `GET /clients/:id`            | Required |       |
| `PATCH /clients/:id`          | Required |       |
| `DELETE /clients/:id`         | Required |       |
| `GET /clients/:id/addresses`  | Required |       |
| `POST /clients/:id/addresses` | Required |       |
