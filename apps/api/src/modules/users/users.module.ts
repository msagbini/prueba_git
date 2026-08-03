import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Users module. */
@Module({
  imports: [AuditLogsModule, MembershipsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
