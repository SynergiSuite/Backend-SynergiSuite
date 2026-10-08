import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClientFeedbackStatus } from '../enums/client_feedback.enums';

export class CreateClientFeedbackReplyDto {
  @IsString({ message: 'Reply message must be a string' })
  @MinLength(1, { message: 'Reply message is required' })
  @MaxLength(5000, { message: 'Reply message cannot exceed 5000 characters' })
  message: string;

  @IsOptional()
  @IsEnum(ClientFeedbackStatus, {
    message:
      'Status must be open, in_progress, in_review, resolved, or rejected',
  })
  status?: ClientFeedbackStatus;
}
