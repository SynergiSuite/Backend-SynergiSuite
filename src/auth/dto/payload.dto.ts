import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class PayloadDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsOptional()
  @IsString({ message: 'Token must be a string' })
  token: string;
}
