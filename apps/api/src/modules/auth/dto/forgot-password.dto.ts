import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Payload for POST /auth/forgot-password. */
export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}
