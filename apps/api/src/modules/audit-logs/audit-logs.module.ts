import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogWriterService } from './audit-log-writer.service';

/**
 * Audit log module. `AuditLogWriterService` is exported so every other
 * business module can record entries to the audit trail this module reads
 * back via `GET /audit-logs` — see `audit-log-writer.service.ts`.
 */
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogWriterService],
  exports: [AuditLogWriterService],
})
export class AuditLogsModule {}
