import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

/** Payment records. */
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param paymentsService implements this controller's routes
   */
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Lists records.
   * @param user the authenticated caller
   * @param pagination the requested page/pageSize
   * @returns a page of payments visible to the caller
   */
  @RequirePermissions('payments.read')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationQueryDto) {
    return this.paymentsService.list(
      { membershipId: user.membershipId, role: user.role },
      pagination,
    );
  }

  /**
   * Creates a record.
   * @param user the authenticated caller
   * @param dto the payment to record
   * @returns the created record
   */
  @RequirePermissions('payments.manage')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user.org, user.sub, dto);
  }

  /**
   * Fetches a single record.
   * @param user the authenticated caller
   * @param id the payment to fetch
   * @returns the matching record
   */
  @RequirePermissions('payments.read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.paymentsService.findOne({ membershipId: user.membershipId, role: user.role }, id);
  }
}
