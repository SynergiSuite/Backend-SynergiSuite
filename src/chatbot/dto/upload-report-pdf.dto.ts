import {
  IsBase64,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ChatbotReportJobType } from '../entities/chatbot-report-file.entity';

export class UploadReportPdfDto {
  @IsString()
  jobName: string;

  @IsEnum(ChatbotReportJobType)
  jobType: ChatbotReportJobType;

  @IsDateString()
  reportPeriodStart: string;

  @IsDateString()
  reportPeriodEnd: string;

  @IsBase64()
  pdfBase64: string;

  @IsOptional()
  @IsString()
  fileName?: string;

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
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
