import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ChatbotReportJobStatus } from '../entities/chatbot-report-job.entity';

export class UpdateReportJobStatusDto {
  @IsEnum(ChatbotReportJobStatus)
  status: ChatbotReportJobStatus;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  generatedPdfBucket?: string;

  @IsOptional()
  @IsString()
  generatedPdfKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
