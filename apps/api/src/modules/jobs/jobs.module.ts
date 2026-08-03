import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/** Jobs module. */
@Module({
  imports: [AuditLogsModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
