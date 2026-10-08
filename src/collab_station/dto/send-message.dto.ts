import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { MessageType } from '../entities/message.entity';

export class SendMessageDto {
  @ValidateIf((o) => !o.fileUrl)
  @IsString({ message: 'Text must be a string' })
  text?: string;

  @IsOptional()
  @IsEnum(MessageType, { message: 'Invalid message type' })
  type?: MessageType;

  @IsOptional()
  @IsString({ message: 'File URL must be a string' })
  fileUrl?: string;

  @IsOptional()
  @IsString({ message: 'File name must be a string' })
  fileName?: string;

  @IsOptional()
  @IsString({ message: 'MIME type must be a string' })
  mimeType?: string;

  @IsOptional()
  @IsNumber({}, { message: 'File size must be a number' })
  fileSize?: number;

  @IsOptional()
  @IsUUID('4', { message: 'replyToId must be a valid UUID' })
  replyToId?: string;
}
