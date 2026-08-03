import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Builds the OpenAPI document for the app — shared by `main.ts` (serves
 * it live at `/api/docs`) and `scripts/generate-openapi.ts` (writes it to
 * `docs/api/openapi.yaml`) so the two never drift apart.
 * @param app the bootstrapped Nest application to introspect
 * @returns the generated OpenAPI document
 */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('DOS API')
    .setDescription(
      'Digital Operations System backend API. Every route except the ones ' +
        "marked @Public() requires a Bearer access token scoped to the caller's active organization.",
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
