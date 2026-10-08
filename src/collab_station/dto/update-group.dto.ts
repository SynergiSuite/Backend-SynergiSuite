import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString({ message: 'Group name must be a string' })
  @MinLength(3, { message: 'Group name must be at least 3 characters long' })
  @MaxLength(50, { message: 'Group name cannot exceed 50 characters' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(255, { message: 'Description cannot exceed 255 characters' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Avatar URL must be a string' })
  avatarUrl?: string;
}
