import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ClientFeedbackTargetType,
  ClientFeedbackType,
} from '../enums/client_feedback.enums';

export class SubmitClientFeedbackDto {
  @IsOptional()
  @IsString({ message: 'Feedback title must be a string' })
  @MinLength(3, {
    message: 'Feedback title must be at least 3 characters long',
  })
  @MaxLength(150, { message: 'Feedback title cannot exceed 150 characters' })
  feedbackTitle?: string;

  @IsOptional()
  @IsString({ message: 'Title of feedback must be a string' })
  @MinLength(3, {
    message: 'Title of feedback must be at least 3 characters long',
  })
  @MaxLength(150, {
    message: 'Title of feedback cannot exceed 150 characters',
  })
  titleOfFeedback?: string;

  @IsOptional()
  @IsEnum(ClientFeedbackType, {
    message:
      'Category must be request, review, issue, question, approval, or general',
  })
  category?: ClientFeedbackType;

  @IsOptional()
  @IsEnum(ClientFeedbackType, {
    message:
      'Feedback type must be request, review, issue, question, approval, or general',
  })
  feedbackType?: ClientFeedbackType;

  @IsOptional()
  @IsUUID('4', { message: 'Project ID must be a valid UUID' })
  projectId?: string;

  @IsOptional()
  @IsEnum(ClientFeedbackTargetType, {
    message: 'Target type must be project, milestone, or task',
  })
  targetType?: ClientFeedbackTargetType;

  @IsOptional()
  @IsUUID('4', { message: 'Type ID must be a valid UUID' })
  typeId?: string;

  @IsString({ message: 'Feedback must be a string' })
  @MinLength(3, { message: 'Feedback must be at least 3 characters long' })
  @MaxLength(5000, { message: 'Feedback cannot exceed 5000 characters' })
  feedback: string;

  @IsOptional()
  @IsInt({ message: 'Rating must be an integer' })
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating cannot exceed 5' })
  rating?: number;

  @IsOptional()
  @IsInt({ message: 'Star rating must be an integer' })
  @Min(1, { message: 'Star rating must be at least 1' })
  @Max(5, { message: 'Star rating cannot exceed 5' })
  starRating?: number;
}
