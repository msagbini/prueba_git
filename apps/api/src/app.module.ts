import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";

/** Root application module — wires together config, infrastructure and feature modules. */
@Module({
  imports: [AppConfigModule, HealthModule],
})
export class AppModule {}
