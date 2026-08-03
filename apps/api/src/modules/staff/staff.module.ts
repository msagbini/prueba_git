import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

/** Staff module. Contract-only in Fase 2 — see staff.service.ts. */
@Module({
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
