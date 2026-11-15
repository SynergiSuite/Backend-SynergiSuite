import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ChatbotReportJobType } from '../entities/chatbot-report-file.entity';

export class RegisterReportFileDto {
  @IsString()
  jobName: string;

  @IsEnum(ChatbotReportJobType)
  jobType: ChatbotReportJobType;

  @IsString()
  bucket: string;

  @IsString()
  objectKey: string;

  @IsDateString()
  reportPeriodStart: string;

  @IsDateString()
  reportPeriodEnd: string;

  @IsOptional()
  @IsDateString()
  generatedAt?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  fileSize?: string;

  @IsOptional()
  @IsString()
  checksum?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
