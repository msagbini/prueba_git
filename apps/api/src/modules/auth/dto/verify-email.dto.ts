import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Payload for POST /auth/verify-email. */
export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token!: string;
}
