import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Query params for `GET /jobs`. `scheduledFrom`/`scheduledTo` are
 * optional and both filter on `scheduledStart` — added for the web
 * dispatch calendar, which needs one week's jobs at a time rather than
 * a `page`/`pageSize` slice ordered across the whole organization.
 * Mirrors the reports module's `DateRangeQueryDto` naming, kept as its
 * own DTO since a "from"/"to" pair without the `jobs.` prefix would
 * collide with a future filter on a different date field.
 */
export class ListJobsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only jobs scheduled at or after this instant, ISO 8601.' })
  @IsOptional()
  @IsISO8601()
  scheduledFrom?: string;

  @ApiPropertyOptional({ description: 'Only jobs scheduled before this instant, ISO 8601.' })
  @IsOptional()
  @IsISO8601()
  scheduledTo?: string;
}
