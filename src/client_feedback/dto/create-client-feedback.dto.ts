import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  MinLength,
  Min,
} from 'class-validator';
import {
  ClientFeedbackStatus,
  ClientFeedbackTargetType,
  ClientFeedbackType,
} from '../enums/client_feedback.enums';

export class CreateClientFeedbackDto {
  @IsUUID('4', { message: 'Client ID must be a valid UUID' })
  clientId: string;

  @IsString({ message: 'Title of feedback must be a string' })
  @MinLength(3, {
    message: 'Title of feedback must be at least 3 characters long',
  })
  @MaxLength(150, {
    message: 'Title of feedback cannot exceed 150 characters',
  })
  titleOfFeedback: string;

  @IsString({ message: 'Feedback must be a string' })
  @MinLength(3, { message: 'Feedback must be at least 3 characters long' })
  @MaxLength(5000, { message: 'Feedback cannot exceed 5000 characters' })
  feedback: string;

  @IsOptional()
  @IsInt({ message: 'Star rating must be an integer' })
  @Min(1, { message: 'Star rating must be at least 1' })
  @Max(5, { message: 'Star rating cannot exceed 5' })
  starRating?: number;

  @IsEnum(ClientFeedbackType, {
    message:
      'Feedback type must be request, review, issue, question, approval, or general',
  })
  feedbackType: ClientFeedbackType;

  @IsEnum(ClientFeedbackTargetType, {
    message: 'Target type must be project, milestone, or task',
  })
  targetType: ClientFeedbackTargetType;

  @IsUUID('4', { message: 'Type ID must be a valid UUID' })
  typeId: string;

  @IsOptional()
  @IsEnum(ClientFeedbackStatus, {
    message:
      'Status must be open, in_progress, in_review, resolved, or rejected',
  })
  status?: ClientFeedbackStatus;
}
