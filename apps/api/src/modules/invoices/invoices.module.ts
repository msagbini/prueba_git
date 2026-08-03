import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/** Invoices module. */
@Module({
  imports: [AuditLogsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
