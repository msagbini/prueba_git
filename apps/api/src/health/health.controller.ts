import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";

/** Liveness/readiness endpoint for load balancers and deploy tooling — carries no business logic. */
@ApiTags("health")
@Controller("health")
export class HealthController {
  /**
   * Returns 200 with a static payload; used to verify the process is up and accepting requests.
   * @returns the current health status and server timestamp
   */
  @Public()
  @Get()
  check(): { status: "ok"; timestamp: string } {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
