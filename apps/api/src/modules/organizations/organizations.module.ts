import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

/** Organization settings module (GET/PATCH /organizations/me). Contract-only in Fase 2 — see organizations.service.ts. */
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
