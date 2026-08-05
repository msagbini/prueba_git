import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressLabel } from '@prisma/client';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';

/** Payload for POST /clients/:id/addresses. */
export class CreateClientAddressDto {
  @ApiProperty({ enum: AddressLabel })
  @IsEnum(AddressLabel)
  label!: AddressLabel;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  state!: string;

  @ApiProperty()
  @IsString()
  postalCode!: string;

  @ApiProperty()
  @IsString()
  country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;
}
