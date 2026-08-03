# modules/payments

Payment records against invoices. Record-keeping only — no
payment-gateway integration (Stripe is Fase 4, per the roadmap in root
`README.md`).

**Fase 2 scope**: contract only — see `payments.service.ts` and root
`CONTRIBUTING.md`.

| Method & path       | Auth     | Notes                                  |
| ------------------- | -------- | -------------------------------------- |
| `GET /payments`     | Required | Scoped to own payments for Client role |
| `POST /payments`    | Required |                                        |
| `GET /payments/:id` | Required |                                        |
