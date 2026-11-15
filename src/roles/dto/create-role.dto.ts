import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  business_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt() 
  primary_role_id?: number;
}
