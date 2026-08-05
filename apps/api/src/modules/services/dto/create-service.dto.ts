import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

/** Payload for POST /services. */
export class CreateServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PricingType })
  @IsEnum(PricingType)
  pricingType!: PricingType;

  @ApiPropertyOptional({ description: 'Required when pricingType is PER_UNIT, e.g. "sq ft".' })
  @IsOptional()
  @IsString()
  unitLabel?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
