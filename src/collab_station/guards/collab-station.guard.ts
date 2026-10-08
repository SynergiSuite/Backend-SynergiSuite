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
export class GroupMemberGuard implements CanActivate {
  private readonly logger = new Logger(GroupMemberGuard.name);

  constructor(private readonly collabStationHelper: CollabStationHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error('User not found in the request');
      throw new UnauthorizedException('User not found');
    }

    const groupId = request.params.groupId;
    if (!groupId) {
      this.logger.error('Group ID not found in the request params');
      throw new ForbiddenException('Group ID is required');
    }

    this.logger.log(
      `Checking if user ${user.email} is a member of group ${groupId}`,
    );
    const userDetails = await this.collabStationHelper.getUserWithBusiness(
      user.email,
    );
    if (!userDetails) {
      this.logger.error(`User details not found: ${user.email}`);
      throw new UnauthorizedException('User not found');
    }

    if (!userDetails.business) {
      this.logger.error(
        `User does not have a registered business: ${user.email}`,
      );
      throw new ForbiddenException('User does not have a registered business');
    }

    const membership = await this.collabStationHelper.findGroupMembership(
      groupId,
      userDetails.user_id,
    );

    if (!membership) {
      this.logger.error(
        `User ${user.email} is not a member of group ${groupId}`,
      );
      throw new ForbiddenException('You are not a member of this group');
    }

    this.logger.log(`User ${user.email} is a member of group ${groupId}`);
    return true;
  }
}
