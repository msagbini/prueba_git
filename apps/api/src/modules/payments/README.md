# modules/payments

Payment records against invoices. Record-keeping only — no
payment-gateway integration (Stripe is Fase 4, per the roadmap in root
`README.md`). A created payment is treated as already received
(`status: COMPLETED`, `paidAt: now()`), and immediately applied to the
invoice — once an invoice's completed payments cover its total, the
invoice is marked `PAID` automatically.

| Method & path       | Auth                        | Notes                                   |
| ------------------- | --------------------------- | --------------------------------------- |
| `GET /payments`     | Required, `payments.read`   | Client role: own payments only          |
| `POST /payments`    | Required, `payments.manage` | May mark the invoice PAID, audit-logged |
| `GET /payments/:id` | Required, `payments.read`   | Same row-level visibility as list       |
