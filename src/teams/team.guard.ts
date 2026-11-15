import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { hasAccessRoleIds } from '../roles/role-access';
import { TeamsHelper } from './teams.helper';

@Injectable()
export class CreateTeamGuard implements CanActivate {
  private readonly logger = new Logger(CreateTeamGuard.name);

  constructor(private readonly teamsHelper: TeamsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, body } = request;

    if (!user) {
      this.logger.error(`No user found in the request`);
      throw new UnauthorizedException('User not authenticated');
    }

    // 1. Fetch the user making the request
    const userDetails = await this.teamsHelper.getUserWithBusiness(user.email);
    const userBusinessId = userDetails?.business?.business_id;

    if (!hasAccessRoleIds(userDetails.role, [1, 2])) {
      throw new ForbiddenException('Only admin and manager can create teams');
    }

    if (!userBusinessId) {
      throw new ForbiddenException('User is not associated with any business');
    }

    // 2. Validate the Leader
    if (!body.leader_id) {
      throw new BadRequestException('leader_id is required');
    }

    const leaderDetails = await this.teamsHelper.findUserById(body.leader_id);
    if (!leaderDetails) {
      this.logger.error(`Leader details not found: ${body.leader_id}`);
      throw new NotFoundException('Leader details not found');
    }

    if (leaderDetails.business?.business_id !== userBusinessId) {
      this.logger.error(
        `Cross-business assignment attempted for leader ${body.leader_id}`,
      );
      throw new ForbiddenException(
        'User and leader are not in the same business',
      );
    }

    // 3. Validate Members (Optimized for performance)
    if (Array.isArray(body.members) && body.members.length > 0) {
      this.logger.log(`Checking ${body.members.length} team members`);

      // OPTIMIZATION: Run all database queries concurrently instead of sequentially
      const memberPromises = body.members.map((memberId) =>
        this.teamsHelper.findUserById(memberId),
      );

      const membersDetails = await Promise.all(memberPromises);

      // Evaluate the results
      for (let i = 0; i < membersDetails.length; i++) {
        const memberDetails = membersDetails[i];
        const requestedMemberId = body.members[i];

        if (!memberDetails) {
          this.logger.error(`Member details not found: ${requestedMemberId}`);
          throw new NotFoundException(
            `Member with ID ${requestedMemberId} not found`,
          );
        }

        if (memberDetails.business?.business_id !== userBusinessId) {
          this.logger.error(
            `Cross-business assignment for member: ${memberDetails.email}`,
          );
          throw new ForbiddenException(
            `Member ${memberDetails.email} is not in your business`,
          );
        }
      }
    }

    return true;
  }
}

// This guard checks if the team is available for the user
@Injectable()
export class validAuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(validAuthorizationGuard.name);

  constructor(private readonly teamsHelper: TeamsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, params } = request;
    const team_id = params?.team_id;

    if (!user?.email) {
      this.logger.error('No authenticated user found in request');
      throw new UnauthorizedException('User not authenticated');
    }

    if (!team_id) {
      this.logger.error('Team ID is missing from the request body');
      throw new BadRequestException('Team ID is required');
    }

    this.logger.log(
      `Validating authorization for user: ${user.email} on team: ${team_id}`,
    );

    const [userDetails, teamDetails] = await Promise.all([
      this.teamsHelper.getUserWithBusiness(user.email),
      this.teamsHelper.findOne(team_id),
    ]);

    if (!userDetails?.business?.business_id) {
      this.logger.error(`User ${user.email} is not associated with a business`);
      throw new ForbiddenException('User is not associated with any business');
    }

    if (!teamDetails) {
      this.logger.error(`Team not found: ${team_id}`);
      throw new NotFoundException(`Team not found`);
    }

    if (
      teamDetails.business?.business_id !== userDetails.business.business_id
    ) {
      this.logger.error(
        `Cross-business access attempt: User ${user.email} to Team ${team_id}`,
      );
      throw new ForbiddenException(
        'User is not authorized to access this team',
      );
    }

    this.logger.log(
      `User ${user.email} successfully authorized for team ${team_id}`,
    );
    return true;
  }
}

// This guard checks if user has right role
@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);
  constructor(private readonly teamsHelper: TeamsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`Checking if user has right role: ${user.email}`);
    const userDetails = await this.teamsHelper.getUserWithBusiness(user.email);
    if (!hasAccessRoleIds(userDetails.role, [1, 2])) {
      this.logger.error(`User does not have right role: ${user.email}`);
      throw new UnauthorizedException(
        'User is not authorized to modify this team',
      );
    }

    this.logger.log(`User has right role: ${user.email}`);
    return true;
  }
}

// This guard checks members if they are valid or not
@Injectable()
export class AddTeamMembersGuard implements CanActivate {
  private readonly logger = new Logger(AddTeamMembersGuard.name);

  constructor(private readonly teamsHelper: TeamsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, body, params } = request;

    if (!user?.email) {
      this.logger.error('No user found in the request');
      throw new UnauthorizedException('User not authenticated');
    }

    const teamId = body?.id || params?.team_id;
    if (!teamId) {
      throw new BadRequestException('Team ID is required');
    }

    const [userDetails, teamDetails] = await Promise.all([
      this.teamsHelper.getUserWithBusiness(user.email),
      this.teamsHelper.findOne(teamId),
    ]);

    const userBusinessId = userDetails?.business?.business_id;

    if (!userBusinessId) {
      this.logger.error(`User ${user.email} has no associated business`);
      throw new ForbiddenException('User is not associated with a business');
    }

    if (!teamDetails) {
      this.logger.error(`Team not found: ${teamId}`);
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    if (teamDetails.business?.business_id !== userBusinessId) {
      this.logger.error(
        `Cross-business access attempt: User ${user.email} adding to team ${teamId}`,
      );
      throw new ForbiddenException(
        'User is not authorized to modify this team',
      );
    }

    this.logger.log('Team validated and belongs to same business');

    // 2. Concurrent Member Validation (Fixing the N+1 problem)
    if (Array.isArray(body.members) && body.members.length > 0) {
      this.logger.log(
        `Checking ${body.members.length} team members concurrently`,
      );

      const memberPromises = body.members.map((memberId) =>
        this.teamsHelper.findUserById(memberId),
      );

      const membersDetails = await Promise.all(memberPromises);

      for (let i = 0; i < membersDetails.length; i++) {
        const memberDetails = membersDetails[i];
        const requestedMemberId = body.members[i];

        if (!memberDetails) {
          this.logger.error(`Member not found: ${requestedMemberId}`);
          throw new NotFoundException(
            `Member with ID ${requestedMemberId} not found`,
          );
        }

        if (memberDetails.business?.business_id !== userBusinessId) {
          this.logger.error(
            `Member ${memberDetails.email} does not belong to the same business as ${user.email}`,
          );
          throw new ForbiddenException(
            `Member ${memberDetails.email} is not in your business`,
          );
        }
      }
    } else {
      this.logger.warn('No members provided in request');
    }

    return true;
  }
}

// This guard checks for removal of members from team
@Injectable()
export class RemoveTeamMembersGuard implements CanActivate {
  private readonly logger = new Logger(RemoveTeamMembersGuard.name);

  constructor(private readonly teamsHelper: TeamsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;

    if (!user) {
      this.logger.error(`No user found in the request`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User found in the request: ${user.email}`);

    const userDetails = await this.teamsHelper.getUserWithBusiness(user.email);
    if (!userDetails) {
      this.logger.error(`User details not found for ${user.email}`);
      throw new UnauthorizedException('Invalid user');
    }

    // validate team
    const teamId = body.id;
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    const teamDetails = await this.teamsHelper.findOne(teamId);
    if (!teamDetails) {
      this.logger.error(`Team not found: ${teamId}`);
      throw new BadRequestException('Invalid team ID');
    }

    // check team belongs to same business
    if (teamDetails.business.business_id !== userDetails.business.business_id) {
      this.logger.error(
        `User and team are not in the same business: ${user.email} and team ${teamId}`,
      );
      throw new UnauthorizedException(
        'User is not authorized to remove members from this team',
      );
    }
    this.logger.log(`Team validated and belongs to same business`);

    // validate members
    if (
      body.members &&
      Array.isArray(body.members) &&
      body.members.length > 0
    ) {
      this.logger.log(
        `Checking ${body.members.length} team members for team ${teamId}`,
      );

      const existingTeamMembers = await this.teamsHelper.findTeamMember(teamId);

      const existingMemberIds = existingTeamMembers.map(
        (tm) => tm.user.user_id,
      );

      for (const memberId of body.members) {
        if (!existingMemberIds.includes(memberId)) {
          this.logger.error(
            `Member with ID ${memberId} is not part of team ${teamId}`,
          );
          throw new BadRequestException(
            `Member with ID ${memberId} is not part of the specified team`,
          );
        }

        const member = existingTeamMembers.find(
          (tm) => tm.user.user_id === memberId,
        );
        if (
          member.user.business.business_id !== userDetails.business.business_id
        ) {
          this.logger.error(
            `Member ${member.user.email} does not belong to the same business as ${user.email}`,
          );
          throw new UnauthorizedException(
            `Member ${member.user.email} is not in the same business`,
          );
        }

        this.logger.log(
          `Member ${member.user.email} is valid and belongs to team ${teamId}`,
        );
      }
    } else {
      this.logger.warn('No members provided in request');
    }
    return true;
  }
}
