import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { IndustryVerticalCode } from '@prisma/client';

/** Payload for POST /auth/signup — creates a new Organization, its Owner User and their membership in one transaction. */
export class SignupDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @ApiProperty({ enum: IndustryVerticalCode })
  @IsEnum(IndustryVerticalCode)
  industryVerticalCode!: IndustryVerticalCode;

  @ApiProperty()
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  ownerFirstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  ownerLastName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}
