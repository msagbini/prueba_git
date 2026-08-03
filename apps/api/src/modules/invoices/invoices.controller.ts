import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';

/** Invoices and their line items. See `invoices.service.ts` for the Fase 2 stub scope note. */
@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param invoicesService implements this controller's routes
   */
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Lists records.
   * @returns invoices visible to the caller.
   */
  @Get()
  list() {
    return this.invoicesService.list();
  }

  /**
   * Creates a record.
   * @param dto the invoice to create
   * @returns the created record
   */
  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(dto);
  }

  /**
   * Fetches a single record.
   * @param id the invoice to fetch
   * @returns the matching record
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  /**
   * Updates a record.
   * @param id the invoice to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  /**
   * Adds a line item to an invoice.
   * @param id the invoice to add a line item to
   * @param dto the line item to create
   * @returns the created line item
   */
  @Post(':id/line-items')
  createLineItem(@Param('id') id: string, @Body() dto: CreateInvoiceLineItemDto) {
    return this.invoicesService.createLineItem(id, dto);
  }
}
