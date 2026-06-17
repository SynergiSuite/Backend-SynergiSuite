import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @Type(() => Number)
  @IsInt({ message: 'User code must be an integer' })
  userCode: number;

  @IsString({ message: 'Updated password must be a string' })
  @MinLength(6, { message: 'Updated password must be at least 6 characters long' })
  updatedPassword: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}
