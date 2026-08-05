import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

/** Payload for POST /jobs. */
export class CreateJobDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceAddressId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @ApiPropertyOptional({ description: 'RRULE string (RFC 5545) for recurring jobs.' })
  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
