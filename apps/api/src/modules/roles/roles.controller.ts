import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Permission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Read-only reference data: the fixed system roles and permissions
 * seeded by `prisma/seed.ts` (see the RBAC matrix in
 * docs/architecture/auth.md). Global tables, no RLS — queried through
 * the plain `PrismaService`, not a tenant-scoped client.
 */
@ApiTags('roles')
@ApiBearerAuth()
@Controller()
export class RolesController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param prisma used to read the global roles/permissions tables
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists roles.
   * @returns every system role.
   */
  @Get('roles')
  listRoles(): Promise<Role[]> {
    return this.prisma.role.findMany();
  }

  /**
   * Lists permissions.
   * @returns every grantable permission.
   */
  @Get('permissions')
  listPermissions(): Promise<Permission[]> {
    return this.prisma.permission.findMany();
  }
}
