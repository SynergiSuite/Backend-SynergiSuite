import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateMilestoneDto {
  @IsNotEmpty({ message: 'ID is required' })
  @IsString({ message: 'ID must be a string' })
  id: string;

  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'End date must be a valid ISO 8601 date string' },
  )
  endDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'End date must be a valid ISO 8601 date string' },
  )
  end_date?: string;

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
