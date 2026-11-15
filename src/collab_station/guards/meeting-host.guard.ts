import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CollabStationHelper } from '../collab_station.helper';
import { MeetingService } from '../services/meeting.service';

@Injectable()
export class MeetingHostGuard implements CanActivate {
  private readonly logger = new Logger(MeetingHostGuard.name);

  constructor(
    private readonly collabStationHelper: CollabStationHelper,
    private readonly meetingService: MeetingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error('User not found in the request');
      throw new UnauthorizedException('User not found');
    }

    const meetingId = request.params.meetingId;
    if (!meetingId) {
      this.logger.error('Meeting ID not found in request params');
      throw new ForbiddenException('Meeting ID is required');
    }

    const userDetails = await this.collabStationHelper.getUserWithBusiness(
      user.email,
    );
    if (!userDetails) {
      this.logger.error(`User details not found: ${user.email}`);
      throw new UnauthorizedException('User not found');
    }

    const isHost = await this.meetingService.isHost(
      meetingId,
      userDetails.user_id,
    );
    if (!isHost) {
      this.logger.error(
        `User ${user.email} is not the host of meeting ${meetingId}`,
      );
      throw new ForbiddenException(
        'Only the meeting host can perform this action',
      );
    }

    this.logger.log(`User ${user.email} is the host of meeting ${meetingId}`);
    return true;
  }
}
