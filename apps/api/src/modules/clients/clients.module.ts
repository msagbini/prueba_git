import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BillingModule } from '../billing/billing.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

/** Clients module. */
@Module({
  imports: [AuditLogsModule, BillingModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
