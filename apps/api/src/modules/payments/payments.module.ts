import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/** Payments module. */
@Module({
  imports: [AuditLogsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
