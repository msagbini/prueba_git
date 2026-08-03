import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Payload for POST /service-categories. */
export class CreateServiceCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}
