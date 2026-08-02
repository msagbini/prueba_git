import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

/** Root application module — wires together config, infrastructure and feature modules. */
@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule, HealthModule],
})
export class AppModule {}
