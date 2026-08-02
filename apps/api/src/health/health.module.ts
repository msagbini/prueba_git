import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Exposes GET /health. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
