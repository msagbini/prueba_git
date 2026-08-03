import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';

/** Exposes GET /plans — read-only reference data. */
@Module({
  controllers: [PlansController],
})
export class PlansModule {}
