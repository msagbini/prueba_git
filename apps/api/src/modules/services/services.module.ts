import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

/** Service catalog module. Contract-only in Fase 2 — see services.service.ts. */
@Module({
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
