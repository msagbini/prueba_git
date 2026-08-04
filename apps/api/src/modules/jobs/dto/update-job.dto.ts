import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/** Payload for PATCH /jobs/:id. */
export class UpdateJobDto {
  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

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

  @ApiPropertyOptional({
    description: 'When work actually started — distinct from the scheduled time.',
  })
  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @ApiPropertyOptional({
    description: 'When work actually ended — distinct from the scheduled time.',
  })
  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
