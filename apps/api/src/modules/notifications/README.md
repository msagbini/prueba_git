# modules/notifications

In-app notifications — surfaces events that already happen elsewhere in
the app as notifications, rather than introducing a new business
process. No email/push delivery; `modules/auth/email` already covers the
one channel (transactional email) auth-related events need.

`notifications.read` is granted to every role — a notification is
personal by construction (scoped to `userId`, checked on every query in
`NotificationsService`, on top of the organization-level RLS every table
gets), so there's nothing left for a permission to additionally gate.

| Method & path                     | Auth                           | Notes                                            |
| --------------------------------- | ------------------------------ | ------------------------------------------------ |
| `GET /notifications`              | Required, `notifications.read` | The caller's own notifications, newest first     |
| `GET /notifications/unread-count` | Required, `notifications.read` | For a nav-bar badge                              |
| `POST /notifications/:id/read`    | Required, `notifications.read` | Idempotent; 404s for another user's notification |

## Where notifications come from

Two triggers today, both reusing an event that already happens rather
than inventing one:

- **`JOB_ASSIGNED`** — `JobsService.createAssignment()` calls
  `NotificationWriterService.create()` (this module's export, mirroring
  `AuditLogWriterService`'s role for the audit trail) right after
  creating the `JobAssignment`, notifying the assigned staff member.
- **`JOB_REMINDER`** — `modules/jobs/job-reminders.service.ts`, a daily
  cron (same `system_job` RLS / `runInTenantTransaction` pattern as
  `RecurringJobsService`) that finds jobs starting within the next 24
  hours and notifies every assigned staff member and — if the client
  has a portal account (an `OrganizationMembership` with `role=CLIENT`
  and `clientId` matching the job's client) — the client too.
  Idempotent by checking for an existing `JOB_REMINDER` notification
  for that job+recipient before creating another, rather than adding a
  new field to `Job` just to track "was a reminder already sent" — the
  `Notification` table already has everything needed for that check.

Adding a third trigger means calling `NotificationWriterService.create()`
(or, from a background job with no request context,
`tx.notification.create()` directly) at the point the underlying event
already happens — never adding a bespoke polling mechanism.
