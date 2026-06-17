import {
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
  IsOptional,
  IsArray,
  ArrayUnique,
} from 'class-validator';

export class CreateMilestoneDto {
  @IsString({ message: 'Name must be a string' })
  @MinLength(3, { message: 'Name should be at least 3 letters long.' })
  @MaxLength(100, { message: 'Name can not exceed 100 characters' })
  name: string;

  @IsDateString({}, { message: 'End date must be a valid ISO 8601 date string' })
  endDate: string;

  @IsOptional()
  @IsString({ message: 'Project ID must be a string' })
  projectId?: string;

  @IsOptional()
  @IsString({ message: 'Project name must be a string' })
  projectName?: string;

  @IsOptional()
  @IsArray({ message: 'Tasks must be an array of task IDs' })
  @ArrayUnique({ message: 'Task IDs must be unique' })
  @IsString({ each: true, message: 'Each task ID must be a string' })
  taskIds?: string[];
}
