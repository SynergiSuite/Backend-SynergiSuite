import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';

export class CreateProjectDto {
  @IsString({ message: 'Project name must be a string' })
  @MinLength(3, { message: 'Project name must be at least 3 characters long' })
  @MaxLength(50, { message: 'Project name cannot exceed 50 characters' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MinLength(10, { message: 'Description is too short (min: 10 characters)' })
  @MaxLength(2000, { message: 'Description cannot exceed 2000 characters' })
  description?: string;

  @IsInt({ message: 'Status must be an integer' })
  status: number;

  @IsArray({ message: 'Teams must be an array of team IDs' })
  @ArrayNotEmpty({ message: 'At least one team must be provided' })
  @ArrayUnique({ message: 'Team IDs must be unique' })
  @IsString({ each: true, message: 'Each team ID must be a string' })
  teams: string[];

  @IsString({ message: 'Client ID must be a string' })
  client: string;
}
