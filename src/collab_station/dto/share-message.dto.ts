import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SharedEntityType } from '../entities/message.entity';

export class ShareMessageDto {
  @IsUUID('4', { message: 'groupId must be a valid UUID' })
  groupId: string;

  @IsEnum(SharedEntityType, { message: 'Invalid shared entity type' })
  entityType: SharedEntityType;

  @IsUUID('4', { message: 'entityId must be a valid UUID' })
  entityId: string;

  @IsOptional()
  @IsString({ message: 'Text must be a string' })
  @MaxLength(5000, { message: 'Text cannot exceed 5000 characters' })
  text?: string;
}
