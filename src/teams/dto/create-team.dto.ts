import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTeamDto {
  @IsNotEmpty({ message: 'Team name is required' })
  @IsString({ message: 'Name must be string!' })
  @Matches(/^[A-Za-z\s]+$/, {
    message: 'Name can only contain letters and spaces',
  })
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MinLength(5, { message: 'Description is too short (min: 5 characters)' })
  @MaxLength(255, { message: 'Description is too long (max: 255 characters)' })
  description?: string;

  @IsNotEmpty({ message: 'Leader ID is required' })
  @IsNumber({}, { message: 'Leader ID must be a number' })
  leader_id: number;

  @IsArray({ message: 'Members must be an array' })
  @ArrayNotEmpty({ message: 'At least one team member is required' })
  @IsInt({ each: true, message: 'Each member ID must be a number' })
  members: number[];
}
