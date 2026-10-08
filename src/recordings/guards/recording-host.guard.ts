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
export class RecordingHostGuard implements CanActivate {
  private readonly logger = new Logger(RecordingHostGuard.name);

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
    const canStop = await this.meetingService.isHostByRoomName(
      roomName,
      userDetails.user_id,
    );

    if (!canStop) {
      this.logger.error(`User ${user.email} is not host of room ${roomName}`);
      throw new ForbiddenException('Only the meeting host can stop recording');
    }

    return true;
  }
}
