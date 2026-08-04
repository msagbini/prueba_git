import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

/** How revenue is bucketed across the requested date range. */
export enum ReportGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/** Query params for GET /reports/revenue. */
export class RevenueQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: ReportGranularity, default: ReportGranularity.DAY })
  @IsOptional()
  @IsEnum(ReportGranularity)
  granularity?: ReportGranularity;
}
