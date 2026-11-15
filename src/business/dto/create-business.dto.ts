import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @MinLength(3)
  @MaxLength(25)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  number_of_employees: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id: number;
}
