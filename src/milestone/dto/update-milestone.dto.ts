import { ArrayUnique, IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString({ message: 'ID must be a string' })
  id: string;

  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO 8601 date string' })
  end_date: string;

  @IsOptional()
  @IsArray({ message: 'Tasks must be an array of task IDs' })
  @ArrayUnique({ message: 'Task IDs must be unique' })
  @IsString({ each: true, message: 'Each task ID must be a string' })
  taskIds?: string[];
}
