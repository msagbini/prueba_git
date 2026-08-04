import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { TopClientsQueryDto } from './dto/top-clients-query.dto';
import { ReportsService } from './reports.service';

/**
 * Read-only operational and financial reports for the caller's active
 * organization. Every route requires `reports.read`, granted only to
 * Owner/Admin — see `prisma/seed.ts`.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('reports.read')
@Controller('reports')
export class ReportsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param reportsService implements this controller's routes
   */
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Total and time-bucketed revenue.
   * @param query the date range and bucket size
   * @returns the revenue report
   */
  @Get('revenue')
  getRevenue(@Query() query: RevenueQueryDto) {
    return this.reportsService.getRevenue(query);
  }

  /**
   * Job counts by status.
   * @param query the date range
   * @returns the jobs summary report
   */
  @Get('jobs-summary')
  getJobsSummary(@Query() query: DateRangeQueryDto) {
    return this.reportsService.getJobsSummary(query);
  }

  /**
   * Per-staff completed-job count and hours worked.
   * @param query the date range
   * @returns the staff performance report
   */
  @Get('staff-performance')
  getStaffPerformance(@Query() query: DateRangeQueryDto) {
    return this.reportsService.getStaffPerformance(query);
  }

  /**
   * Highest-revenue clients.
   * @param query the date range and result limit
   * @returns the top clients report
   */
  @Get('top-clients')
  getTopClients(@Query() query: TopClientsQueryDto) {
    return this.reportsService.getTopClients(query);
  }

  /**
   * Invoices not yet fully paid, as of now.
   * @returns the outstanding invoices report
   */
  @Get('outstanding-invoices')
  getOutstandingInvoices() {
    return this.reportsService.getOutstandingInvoices();
  }
}
