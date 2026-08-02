import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Provides {@link PrismaService} application-wide. Global so feature
 * modules don't each need to re-import it — see
 * docs/architecture/multi-tenancy.md for the full data-access story,
 * including the tenant-scoped extension added on top of this in a later
 * Fase 2 step.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
