import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';

/** Invoices and their line items. */
@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('invoices')
export class InvoicesController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param invoicesService implements this controller's routes
   * @param invoicePdfService renders an invoice as a PDF for the `.../pdf` route
   */
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  /**
   * Lists records.
   * @param user the authenticated caller
   * @param pagination the requested page/pageSize
   * @returns a page of invoices visible to the caller
   */
  @RequirePermissions('invoices.read')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationQueryDto) {
    return this.invoicesService.list(
      { membershipId: user.membershipId, role: user.role },
      pagination,
    );
  }

  /**
   * Creates a record.
   * @param user the authenticated caller
   * @param dto the invoice to create
   * @returns the created record
   */
  @RequirePermissions('invoices.manage')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.org, user.sub, dto);
  }

  /**
   * Fetches a single record.
   * @param user the authenticated caller
   * @param id the invoice to fetch
   * @returns the matching record
   */
  @RequirePermissions('invoices.read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.findOne({ membershipId: user.membershipId, role: user.role }, id);
  }

  /**
   * Renders an invoice as a PDF.
   * @param user the authenticated caller
   * @param id the invoice to render
   * @param res used to set the response's Content-Type/Content-Disposition
   * @returns a stream of the generated PDF's bytes
   */
  @RequirePermissions('invoices.read')
  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const data = await this.invoicesService.getPdfData(
      { membershipId: user.membershipId, role: user.role },
      id,
    );
    const pdf = this.invoicePdfService.generate(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${data.invoice.invoiceNumber}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  /**
   * Updates a record.
   * @param user the authenticated caller
   * @param id the invoice to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @RequirePermissions('invoices.manage')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
      dto,
    );
  }

  /**
   * Adds a line item to an invoice.
   * @param user the authenticated caller
   * @param id the invoice to add a line item to
   * @param dto the line item to create
   * @returns the created line item
   */
  @RequirePermissions('invoices.manage')
  @Post(':id/line-items')
  createLineItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateInvoiceLineItemDto,
  ) {
    return this.invoicesService.createLineItem(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
      dto,
    );
  }
}
