import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from '../activity/entities/activity-log.entity';
import { Business } from '../business/entities/business.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientFeedbackReply } from '../client_feedback/entities/client-feedback-reply.entity';
import { ClientFeedback } from '../client_feedback/entities/client-feedback.entity';
import { Call } from '../collab_station/entities/call.entity';
import { Meeting } from '../collab_station/entities/meeting.entity';
import { Message } from '../collab_station/entities/message.entity';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../projects/entities/task.entity';
import { Team } from '../teams/entities/team.entity';
import { UserModule } from '../user/user.module';
import { User } from '../user/entities/user.entity';
import { AnalyticsRecord } from './entities/analytics-record.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsHelper } from './analytics.helper';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivityLog,
      AnalyticsRecord,
      Business,
      Client,
      ClientFeedback,
      ClientFeedbackReply,
      Call,
      Meeting,
      Message,
      Project,
      Task,
      Team,
      User,
    ]),
    UserModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsHelper],
  exports: [AnalyticsService, AnalyticsHelper],
})
export class AnalyticsModule {}
