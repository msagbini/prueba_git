import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around PrismaClient that connects on module init and
 * disconnects on shutdown. Multi-tenant query scoping (the `SET LOCAL
 * app.current_org_id` + Prisma Client Extension mechanism described in
 * docs/architecture/multi-tenancy.md) is layered on top of this in
 * `tenant-prisma.service.ts` — this class is the plain, unscoped client
 * used for schema-level and cross-tenant operations only (e.g. the seed
 * script, migrations tooling).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Opens the database connection when the Nest module is initialized. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  /** Closes the database connection on application shutdown. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
