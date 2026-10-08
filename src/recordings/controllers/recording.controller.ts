import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { MeetingService } from '../../collab_station/services/meeting.service';
import { JwtGuard } from '../../shared/auth.guard';
import { IsVerifiedGuard } from '../../shared/isVerified.guard';
import { UserHelper } from '../../user/user.helper';
import { SaveRecordingTranscriptDto } from '../dto/save-recording-transcript.dto';
import { RecordingHostGuard } from '../guards/recording-host.guard';
import { RecordingParticipantGuard } from '../guards/recording-participant.guard';
import { RecordingService } from '../services/recording.service';

@Controller('api/recordings')
export class RecordingController {
  constructor(
    private readonly recordingService: RecordingService,
    private readonly meetingService: MeetingService,
    private readonly userHelper: UserHelper,
  ) {}

  @Get()
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async getRecordings(@Req() req: Request) {
    const user = await this.userHelper.getUserWithBusinessDetail(
      (req.user as any).email,
    );
    const roomNames = await this.meetingService.findRoomNamesForUser(
      user.user_id,
    );
    return this.recordingService.getRecordingsForRooms(roomNames);
  }

  @Get(':roomName')
  @UseGuards(JwtGuard, IsVerifiedGuard, RecordingParticipantGuard)
  async getRecording(@Param('roomName') roomName: string) {
    return this.recordingService.getLatestRecording(roomName);
  }

  @Post(':roomName/stop')
  @UseGuards(JwtGuard, IsVerifiedGuard, RecordingHostGuard)
  async stopRecording(@Param('roomName') roomName: string) {
    return this.recordingService.stopActiveRecording(roomName);
  }

  @Get(':roomName/transcript')
  @UseGuards(JwtGuard, IsVerifiedGuard, RecordingParticipantGuard)
  async getTranscript(@Param('roomName') roomName: string) {
    return this.recordingService.getTranscript(roomName);
  }

  @Post(':roomName/transcript')
  @UseGuards(JwtGuard, IsVerifiedGuard, RecordingParticipantGuard)
  async saveTranscript(
    @Param('roomName') roomName: string,
    @Body() body: SaveRecordingTranscriptDto,
  ) {
    return this.recordingService.saveTranscript(roomName, body);
  }

  @Get(':roomName/playback-url')
  @UseGuards(JwtGuard, IsVerifiedGuard, RecordingParticipantGuard)
  async getPlaybackUrl(@Param('roomName') roomName: string) {
    return this.recordingService.getPlaybackUrl(roomName);
  }
}
