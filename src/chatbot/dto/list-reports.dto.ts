import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListReportsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Expires in must be an integer' })
  @Min(60, { message: 'Expires in must be at least 60 seconds' })
  @Max(3600, { message: 'Expires in cannot exceed 3600 seconds' })
  expiresIn?: number;
}
