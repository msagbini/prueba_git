import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

/** Shared from/to query params for report endpoints. Both optional — see each service method for its default range. */
export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Start of the range (inclusive), ISO 8601.' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End of the range (exclusive), ISO 8601.' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
