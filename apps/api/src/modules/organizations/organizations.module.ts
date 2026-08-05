import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

/** Organization settings module (GET/PATCH /organizations/me). */
@Module({
  imports: [AuditLogsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
