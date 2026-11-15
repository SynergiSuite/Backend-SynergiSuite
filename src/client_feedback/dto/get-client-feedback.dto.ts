import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  ClientFeedbackStatus,
  ClientFeedbackTargetType,
  ClientFeedbackType,
} from '../enums/client_feedback.enums';

export class GetClientFeedbackDto {
  @IsOptional()
  @IsUUID('4', { message: 'Client ID must be a valid UUID' })
  clientId?: string;

  @IsOptional()
  @IsEnum(ClientFeedbackTargetType)
  targetType?: ClientFeedbackTargetType;

  @IsOptional()
  @IsUUID('4', { message: 'Type ID must be a valid UUID' })
  typeId?: string;

  @IsOptional()
  @IsEnum(ClientFeedbackType)
  feedbackType?: ClientFeedbackType;

  @IsOptional()
  @IsEnum(ClientFeedbackStatus)
  status?: ClientFeedbackStatus;

  @IsOptional()
  page?: number;
}
