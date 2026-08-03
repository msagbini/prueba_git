import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

/** Membership management module. Contract-only in Fase 2 — see memberships.service.ts. */
@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService],
})
export class MembershipsModule {}
