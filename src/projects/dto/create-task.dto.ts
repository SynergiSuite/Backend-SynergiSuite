import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsDateString,
  ArrayMinSize,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  @IsString({ message: 'Title must be a string' })
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(100, { message: 'Title cannot exceed 100 characters' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(2000, { message: 'Description cannot exceed 2000 characters' })
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Invalid task status' })
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Invalid task priority' })
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString({}, { message: 'Due date must be a valid ISO 8601 date string' })
  dueDate?: string;

  @IsString({ message: 'Project ID must be a string' })
  projectId: string;

  @IsOptional()
  @IsString({ message: 'Milestone ID must be a string' })
  milestoneId?: string;
  
  @IsOptional()
  @IsString({ message: 'Assigned team ID must be a string' })
  assigneeId?: string;

  @IsOptional()
  @IsString({ message: 'Project name must be a string' })
  projectName?: string;
}
