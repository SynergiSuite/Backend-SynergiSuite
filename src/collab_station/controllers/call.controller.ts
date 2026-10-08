import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../shared/auth.guard';
import { IsVerifiedGuard } from '../../shared/isVerified.guard';
import { CallParticipantGuard } from '../guards/call-participant.guard';
import { CallService } from '../services/call.service';
import { CollabStationHelper } from '../collab_station.helper';

@Controller('collab-station/calls')
export class CallController {
  constructor(
    private readonly callService: CallService,
    private readonly collabStationHelper: CollabStationHelper,
  ) {}

  @Get('current')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async getCurrentCall(@Req() req: Request) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.callService.getCurrentCall(user.user_id);
  }

  @Get('missed')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async getMissedCalls(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.callService.getMissedCalls(user.user_id, parsedLimit, cursor);
  }

  @Get()
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async getCallHistory(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.callService.getCallHistory(user.user_id, parsedLimit, cursor);
  }

  @Post(':callId/token')
  @UseGuards(JwtGuard, IsVerifiedGuard, CallParticipantGuard)
  async getCallToken(@Req() req: Request, @Param('callId') callId: string) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.callService.getCallToken(callId, user.user_id, user.name);
  }
}
