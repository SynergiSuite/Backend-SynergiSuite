import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString({ message: 'Old password must be a string' })
  @MinLength(6, { message: 'Old password must be at least 6 characters long' })
  oldPassword: string;

  @IsString({ message: 'Updated password must be a string' })
  @MinLength(6, { message: 'Updated password must be at least 6 characters long' })
  updatedPassword: string;
}
