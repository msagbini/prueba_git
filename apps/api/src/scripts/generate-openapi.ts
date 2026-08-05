import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import * as yaml from 'js-yaml';
import { AppModule } from '../app.module';
import { buildSwaggerDocument } from '../swagger';

/**
 * Regenerates `docs/api/openapi.yaml` from the live Swagger decorators —
 * the same document `main.ts` serves at `/api/docs`, written to disk so
 * it can be reviewed and diffed in PRs (see root `CONTRIBUTING.md`'s
 * documentation rules). Run via `pnpm docs:api`; never hand-edited.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildSwaggerDocument(app);

  const outputPath = join(__dirname, '../../../../docs/api/openapi.yaml');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, yaml.dump(document, { noRefs: true }));

  await app.close();
  console.log(`Wrote OpenAPI document to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
