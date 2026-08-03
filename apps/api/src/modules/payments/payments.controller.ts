import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

/** Payment records. See `payments.service.ts` for the Fase 2 stub scope note. */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param paymentsService implements this controller's routes
   */
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Lists records.
   * @returns payments visible to the caller.
   */
  @Get()
  list() {
    return this.paymentsService.list();
  }

  /**
   * Creates a record.
   * @param dto the payment to record
   * @returns the created record
   */
  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  /**
   * Fetches a single record.
   * @param id the payment to fetch
   * @returns the matching record
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }
}
