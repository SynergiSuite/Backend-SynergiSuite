import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../shared/auth.guard';
import { IsVerifiedGuard } from '../../shared/isVerified.guard';
import { CollabStationHelper } from '../collab_station.helper';
import { CreateMeetingDto, toMeetingResponseDto } from '../dto/meeting.dto';
import { MeetingHostGuard } from '../guards/meeting-host.guard';
import { MeetingParticipantGuard } from '../guards/meeting-participant.guard';
import { MeetingService } from '../services/meeting.service';

@Controller('collab-station/meetings')
export class MeetingController {
  constructor(
    private readonly meetingService: MeetingService,
    private readonly collabStationHelper: CollabStationHelper,
  ) {}

  @Post()
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async createMeeting(@Req() req: Request, @Body() dto: CreateMeetingDto) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const meeting = await this.meetingService.createMeeting(
      dto,
      user.user_id,
      user.name,
    );
    return toMeetingResponseDto(meeting);
  }

  @Get()
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async getMeetings(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.meetingService.findForUser(user.user_id, parsedLimit, cursor);
  }

  @Get(':meetingId')
  @UseGuards(JwtGuard, IsVerifiedGuard, MeetingParticipantGuard)
  async getMeeting(@Req() req: Request, @Param('meetingId') meetingId: string) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.meetingService.getMeeting(meetingId, user.user_id);
  }

  @Post(':meetingId/start')
  @UseGuards(JwtGuard, IsVerifiedGuard, MeetingHostGuard)
  async startMeeting(
    @Req() req: Request,
    @Param('meetingId') meetingId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const meeting = await this.meetingService.startMeeting(
      meetingId,
      user.user_id,
    );
    return toMeetingResponseDto(meeting);
  }

  @Post(':meetingId/join')
  @UseGuards(JwtGuard, IsVerifiedGuard, MeetingParticipantGuard)
  async joinMeeting(
    @Req() req: Request,
    @Param('meetingId') meetingId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const meeting = await this.meetingService.joinMeeting(
      meetingId,
      user.user_id,
    );
    return toMeetingResponseDto(meeting);
  }

  @Post(':meetingId/leave')
  @UseGuards(JwtGuard, IsVerifiedGuard, MeetingParticipantGuard)
  async leaveMeeting(
    @Req() req: Request,
    @Param('meetingId') meetingId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const meeting = await this.meetingService.leaveMeeting(
      meetingId,
      user.user_id,
    );
    return toMeetingResponseDto(meeting);
  }

  @Post(':meetingId/end')
  @UseGuards(JwtGuard, IsVerifiedGuard, MeetingHostGuard)
  async endMeeting(@Req() req: Request, @Param('meetingId') meetingId: string) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const meeting = await this.meetingService.endMeeting(
      meetingId,
      user.user_id,
    );
    return toMeetingResponseDto(meeting);
  }

  @Post(':meetingId/cancel')
  @UseGuards(JwtGuard, IsVerifiedGuard, MeetingHostGuard)
  async cancelMeeting(
    @Req() req: Request,
    @Param('meetingId') meetingId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const meeting = await this.meetingService.cancelMeeting(
      meetingId,
      user.user_id,
    );
    return toMeetingResponseDto(meeting);
  }

  @Post(':meetingId/token')
  @UseGuards(JwtGuard, IsVerifiedGuard, MeetingParticipantGuard)
  async getMeetingToken(
    @Req() req: Request,
    @Param('meetingId') meetingId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.meetingService.getMeetingToken(
      meetingId,
      user.user_id,
      user.name,
    );
  }
}
