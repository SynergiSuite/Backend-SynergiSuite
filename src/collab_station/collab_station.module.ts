import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Message } from './entities/message.entity';
import { Call } from './entities/call.entity';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { GroupService } from './services/group.service';
import { MessageService } from './services/message.service';
import { CallService } from './services/call.service';
import { MeetingService } from './services/meeting.service';
import { ChatGateway } from './gateways/chat.gateway';
import { CallGateway } from './gateways/call.gateway';
import { MeetingGateway } from './gateways/meeting.gateway';
import { GroupController } from './controllers/group.controller';
import { MessageController } from './controllers/message.controller';
import { CallController } from './controllers/call.controller';
import { MeetingController } from './controllers/meeting.controller';
import { GroupMemberGuard } from './guards/collab-station.guard';
import { CallParticipantGuard } from './guards/call-participant.guard';
import { MeetingParticipantGuard } from './guards/meeting-participant.guard';
import { MeetingHostGuard } from './guards/meeting-host.guard';
import { UserModule } from '../user/user.module';
import { MinIOModule } from '../minIO/minIO.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MediaModule } from '../media/media.module';
import { CollabStationHelper } from './collab_station.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Group,
      GroupMember,
      Message,
      Call,
      Meeting,
      MeetingParticipant,
    ]),
    UserModule,
    forwardRef(() => MinIOModule),
    NotificationsModule,
    RealtimeModule,
    MediaModule,
  ],
  controllers: [
    GroupController,
    MessageController,
    CallController,
    MeetingController,
  ],
  providers: [
    GroupService,
    MessageService,
    CallService,
    MeetingService,
    CollabStationHelper,
    ChatGateway,
    CallGateway,
    MeetingGateway,
    GroupMemberGuard,
    CallParticipantGuard,
    MeetingParticipantGuard,
    MeetingHostGuard,
  ],
  exports: [GroupService, CallService, MeetingService, CollabStationHelper],
})
export class CollabStationModule {}
