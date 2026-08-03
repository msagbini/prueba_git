import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/** Jobs module. Contract-only in Fase 2 — see jobs.service.ts. */
@Module({
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
