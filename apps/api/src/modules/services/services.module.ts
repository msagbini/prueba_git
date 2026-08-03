import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

/** Service catalog module. */
@Module({
  imports: [AuditLogsModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
