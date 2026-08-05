import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditLogsService } from './audit-logs.service';

/** Read-only audit trail. Owner/Admin only. See `audit-logs.service.ts` for the Fase 2 stub scope note. */
@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.OWNER, RoleCode.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param auditLogsService implements this controller's routes
   */
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /**
   * Lists records.
   * @returns audit log entries for the caller's active organization.
   */
  @Get()
  list() {
    return this.auditLogsService.list();
  }
}
