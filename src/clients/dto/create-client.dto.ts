import {
  IsString,
  IsEmail,
  MaxLength,
  MinLength,
  IsOptional,
  IsInt,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClientPaymentType } from '../entities/client.entity';

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

  @IsOptional()
  @IsString({ message: 'Company must be a string' })
  @MaxLength(255, { message: 'Company cannot exceed 255 characters' })
  company?: string;

  @IsInt({ message: 'Priority must be an integer' })
  priority: number;

  @IsOptional()
  @IsEnum(ClientPaymentType, {
    message: 'Payment type must be either per_hour or each_milestone',
  })
  paymentType?: ClientPaymentType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number' })
  amount?: number;
}
