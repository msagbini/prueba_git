-- CreateIndex
CREATE INDEX "client_addresses_client_id_idx" ON "client_addresses"("client_id");

-- CreateIndex
CREATE INDEX "clients_organization_id_name_idx" ON "clients"("organization_id", "name");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_issue_date_idx" ON "invoices"("organization_id", "issue_date");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "job_assignments_job_id_idx" ON "job_assignments"("job_id");

-- CreateIndex
CREATE INDEX "job_attachments_job_id_idx" ON "job_attachments"("job_id");

-- CreateIndex
CREATE INDEX "job_services_job_id_idx" ON "job_services"("job_id");

-- CreateIndex
CREATE INDEX "jobs_organization_id_scheduled_start_idx" ON "jobs"("organization_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "jobs_parent_job_id_idx" ON "jobs"("parent_job_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "services_organization_id_name_idx" ON "services"("organization_id", "name");

-- CreateIndex
CREATE INDEX "staff_profiles_organization_id_created_at_idx" ON "staff_profiles"("organization_id", "created_at");
