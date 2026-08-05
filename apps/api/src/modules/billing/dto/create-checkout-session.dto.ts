import { ApiProperty } from '@nestjs/swagger';
import { PlanCode } from '@prisma/client';
import { IsEnum } from 'class-validator';

/** Payload for POST /organizations/me/subscription/checkout. */
export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: PlanCode, description: 'The plan to subscribe to — must not be FREE.' })
  @IsEnum(PlanCode)
  planCode!: PlanCode;
}
