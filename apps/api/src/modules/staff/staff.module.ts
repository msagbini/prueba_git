import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

/** Staff module. */
@Module({
  imports: [AuditLogsModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
