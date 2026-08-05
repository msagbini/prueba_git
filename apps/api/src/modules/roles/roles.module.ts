import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';

/** Exposes GET /roles and GET /permissions — read-only reference data. */
@Module({
  controllers: [RolesController],
})
export class RolesModule {}
