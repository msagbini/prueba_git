import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Plan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Read-only reference data: the subscription tiers DOS itself sells to
 * organizations (see `docs/technical-log/phase-4.md`) — global, no RLS,
 * queried through the plain `PrismaService`, same pattern as
 * `modules/roles`.
 */
@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  /**
   * Constructs the controller around the client it reads plans from.
   * @param prisma used to read the global plans table
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists plans.
   * @returns every subscription plan, cheapest first
   */
  @Get()
  list(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { priceMonthlyCents: 'asc' } });
  }
}
