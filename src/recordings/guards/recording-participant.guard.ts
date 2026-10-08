import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { MeetingService } from '../../collab_station/services/meeting.service';
import { UserHelper } from '../../user/user.helper';

@Injectable()
export class RecordingParticipantGuard implements CanActivate {
  private readonly logger = new Logger(RecordingParticipantGuard.name);

  constructor(
    private readonly meetingService: MeetingService,
    private readonly userHelper: UserHelper,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const roomName = request.params.roomName;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userDetails = await this.userHelper.getUserWithBusinessDetail(
      user.email,
    );
    const canAccess = await this.meetingService.isParticipantByRoomName(
      roomName,
      userDetails.user_id,
    );

    if (!canAccess) {
      this.logger.error(
        `User ${user.email} is not a participant of room ${roomName}`,
      );
      throw new ForbiddenException('You cannot access this recording');
    }

    return true;
  }
}
