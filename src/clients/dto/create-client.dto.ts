import {
  IsString,
  IsEmail,
  MaxLength,
  MinLength,
  IsOptional,
  IsInt,
} from 'class-validator';

export class CreateClientDto {
  @IsString({ message: 'Client name must be a string' })
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(20, { message: 'Phone cannot exceed 20 characters' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
  address?: string;

  @IsInt({ message: 'Priority must be an integer' })
  priority: number;
}
