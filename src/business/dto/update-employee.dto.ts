import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString({ message: 'Salary must be a string' })
  salary?: string;

  @IsOptional()
  @IsInt({ message: 'Role ID must be a number' })
  roleId?: number;
}
