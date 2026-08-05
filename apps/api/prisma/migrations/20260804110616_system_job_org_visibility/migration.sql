-- The recurring-job materializer (Fase 9) runs on a schedule, not inside
-- a request, so it has no caller-derived app.current_org_id/
-- app.current_user_id to scope by (see docs/architecture/multi-tenancy.md).
-- It genuinely needs to enumerate every organization once per run, before
-- doing the real per-organization work through the normal tenant-scoped
-- path (runInTenantTransaction) like everything else in this app.
--
-- This is deliberately NOT solved with the dos_migrator (BYPASSRLS) role
-- -- that role is reserved for `prisma migrate` only, documented as such
-- since Fase 2, and reaching for it here would blur that boundary for
-- every future background job. Instead: one narrow, explicit, read-only
-- policy -- SELECT only, only on "organizations" (not any business
-- table), gated by its own session flag that only this one service ever
-- sets. Everything the materializer actually reads/writes about a job
-- still goes through the ordinary per-organization RLS path.
CREATE POLICY system_job_read_all ON "organizations"
  FOR SELECT
  USING (current_setting('app.system_job', true) = 'true');
