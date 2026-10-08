import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { Business } from '../business/entities/business.entity';
import { MinIOModule } from '../minIO/minIO.module';
import { Team } from '../teams/entities/team.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { ChatbotController } from './chatbot.controller';
import { ChatbotHelper } from './chatbot.helper';
import { ChatbotService } from './chatbot.service';
import { ChatbotReportFile } from './entities/chatbot-report-file.entity';
import { ChatbotReportJob } from './entities/chatbot-report-job.entity';
import { Report } from './entities/report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatbotReportJob,
      ChatbotReportFile,
      Report,
      Business,
      Team,
      User,
    ]),
    AnalyticsModule,
    MinIOModule,
    UserModule,
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotHelper],
  exports: [ChatbotService, ChatbotHelper],
})
export class ChatbotModule {}
