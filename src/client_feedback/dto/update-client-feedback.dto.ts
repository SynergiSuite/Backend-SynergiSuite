import { PartialType } from '@nestjs/mapped-types';
import { CreateClientFeedbackDto } from './create-client-feedback.dto';

export class UpdateClientFeedbackDto extends PartialType(
  CreateClientFeedbackDto,
) {}
