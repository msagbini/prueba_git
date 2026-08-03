import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Users module. Contract-only in Fase 2 — see users.service.ts. */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
