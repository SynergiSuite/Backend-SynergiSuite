import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ChatbotReportJobStatus } from '../entities/chatbot-report-job.entity';

export class UpsertReportJobDto {
  @IsString()
  jobName: string;

  @IsOptional()
  @IsEnum(ChatbotReportJobStatus)
  status?: ChatbotReportJobStatus;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
