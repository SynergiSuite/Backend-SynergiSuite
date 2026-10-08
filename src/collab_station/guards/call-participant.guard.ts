import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CollabStationHelper } from '../collab_station.helper';

@Injectable()
export class CallParticipantGuard implements CanActivate {
  private readonly logger = new Logger(CallParticipantGuard.name);

  constructor(private readonly collabStationHelper: CollabStationHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error('User not found in the request');
      throw new UnauthorizedException('User not found');
    }

    const callId = request.params.callId;
    if (!callId) {
      this.logger.error('Call ID not found in request params');
      throw new ForbiddenException('Call ID is required');
    }

    const userDetails = await this.collabStationHelper.getUserWithBusiness(
      user.email,
    );
    if (!userDetails) {
      this.logger.error(`User details not found: ${user.email}`);
      throw new UnauthorizedException('User not found');
    }

    const call = await this.collabStationHelper.findCallById(callId);

    if (!call) {
      this.logger.error(`Call with ID ${callId} not found`);
      throw new ForbiddenException('Call not found');
    }

    if (
      !this.collabStationHelper.isCallParticipant(call, userDetails.user_id)
    ) {
      this.logger.error(
        `User ${user.email} is not a participant of call ${callId}`,
      );
      throw new ForbiddenException('You are not a participant of this call');
    }

    this.logger.log(`User ${user.email} is a participant of call ${callId}`);
    return true;
  }
}
