import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module';
import { Client } from '../clients/entities/client.entity';
import { Milestone } from '../milestone/entities/milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../projects/entities/task.entity';
import { UserModule } from '../user/user.module';
import { ClientFeedbackController } from './client_feedback.controller';
import {
  ClientHasOngoingProjectGuard,
  ValidClientFeedbackSubmissionGuard,
} from './client_feedback.guard';
import { ClientFeedbackHelper } from './client_feedback.helper';
import { ClientFeedbackService } from './client_feedback.service';
import { ClientFeedbackReply } from './entities/client-feedback-reply.entity';
import { ClientFeedback } from './entities/client-feedback.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientFeedback,
      ClientFeedbackReply,
      Client,
      Project,
      Milestone,
      Task,
    ]),
    UserModule,
    ActivityModule,
  ],
  controllers: [ClientFeedbackController],
  providers: [
    ClientFeedbackService,
    ClientFeedbackHelper,
    ValidClientFeedbackSubmissionGuard,
    ClientHasOngoingProjectGuard,
  ],
  exports: [ClientFeedbackService],
})
export class ClientFeedbackModule {}
