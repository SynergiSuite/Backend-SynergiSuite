import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollabStationModule } from '../collab_station/collab_station.module';
import { MinIOModule } from '../minIO/minIO.module';
import { UserModule } from '../user/user.module';
import { LiveKitWebhookController } from './controllers/livekit-webhook.controller';
import { RecordingController } from './controllers/recording.controller';
import { MeetingRecording } from './entities/meeting-recording.entity';
import { RecordingHostGuard } from './guards/recording-host.guard';
import { RecordingParticipantGuard } from './guards/recording-participant.guard';
import { RecordingService } from './services/recording.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeetingRecording]),
    forwardRef(() => CollabStationModule),
    MinIOModule,
    UserModule,
  ],
  controllers: [LiveKitWebhookController, RecordingController],
  providers: [RecordingService, RecordingParticipantGuard, RecordingHostGuard],
  exports: [RecordingService],
})
export class RecordingsModule {}
