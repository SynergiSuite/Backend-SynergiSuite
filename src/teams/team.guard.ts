import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { Logger } from '@nestjs/common';
import { TeamsService } from './teams.service';


@Injectable()
export class createTeamGuard implements CanActivate {
    private readonly logger = new Logger(createTeamGuard.name);
    constructor(
        private readonly userService: UserService,
    ){}
    
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        this.logger.log(`Looking for user in the request`)
        const user = request.user;
        const body = request.body;
        if(!user){
            this.logger.error(`No user found in the request`);
            throw new UnauthorizedException('User not found');
        }
        this.logger.log(`User found in the request: ${user.email}`);

        this.logger.log(`Checking for user details: ${user.email}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        this.logger.log(`User details found: ${user.email}`);

        this.logger.log(`Checking for leader details: ${body.leader_id}`);
        const leaderDetails = await this.userService.findOne(body.leader_id);
        if (!leaderDetails) {
            this.logger.error(`Leader details not found: ${body.leader_id}`);
            throw new UnauthorizedException('Leader details not found');
        }
        this.logger.log(`Leader details found: ${leaderDetails.email}`);

        this.logger.log(`Checking if user and leader are in the same business: ${user.email} and ${leaderDetails.email}`);
        if (userDetails.business.business_id !== leaderDetails.business.business_id) {
            this.logger.error(`User and leader are not in the same business: ${user.email} and ${leaderDetails.email}`);
            throw new UnauthorizedException('User and leader are not in the same business');
        }
        this.logger.log(`User and leader are in the same business: ${user.email} and ${leaderDetails.email}`);

        if (body.members && Array.isArray(body.members) && body.members.length > 0) {
            this.logger.log(`Checking ${body.members.length} team members`);

            for (const memberId of body.members) {
                const memberDetails = await this.userService.findOne(memberId);
                if (!memberDetails) {
                  this.logger.error(`Member details not found: ${memberId}`);
                  throw new UnauthorizedException(`Member with ID ${memberId} not found`);
                }

                if (
                    userDetails.business.business_id !==
                    memberDetails.business.business_id
                  ) {
                    this.logger.error(
                      `User and member are not in the same business: ${user.email} and ${memberDetails.email}`,
                    );
                    throw new UnauthorizedException(
                      `Member ${memberDetails.email} is not in the same business`,
                    );
                  }

                  this.logger.log(
                    `Member is valid and belongs to the same business: ${memberDetails.email}`,
                  );
            }
        }
        return true;
        
    }
}

// This guard checks if the team is available for the user
@Injectable()
export class validAuthorizationGuard implements CanActivate {
    private readonly logger = new Logger(validAuthorizationGuard.name);
    constructor(
        private readonly userService: UserService,
        private readonly teamService: TeamsService
    ){} 

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const team_id = request.body.team;
        
        this.logger.log(`Looking for user: ${user.email}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        this.logger.log(`User details found: ${user.email}`);
        
        this.logger.log(`Looking for team: ${team_id}`);
        const teamDetails = await this.teamService.findOne(team_id);
        this.logger.log(`Team details found: ${team_id}`);

        this.logger.log(`Checking if team id is valid`);
        if(!teamDetails){
          this.logger.error(`Team not found: ${team_id}`);
          throw new BadRequestException(`Invalid team ID`);
        }
        this.logger.log(`Team id is valid: ${team_id}`);

        this.logger.log(`Checking if team id is correct`);
        if(teamDetails.business.business_id !== userDetails.business.business_id){
          this.logger.error(`User and team are not in the same business: ${user.email} and ${teamDetails.business.business_id}`);
          throw new UnauthorizedException(`User is not authorized to access this team`);
        }
        this.logger.log(`User is authorized to access this team: ${user.email}`);
        return true;
    }
}

// This guard checks if user has right role
@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        this.logger.log(`Checking if user has right role: ${user.email}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        if(userDetails.role.id !== 1 && userDetails.role.id !== 2){
          this.logger.error(`User does not have right role: ${user.email}`);
          throw new UnauthorizedException('User is not authorized to modify this team');
        }
        this.logger.log(`User has right role: ${user.email}`);
        return true;
    }
}


// This guard checks members if they are valid or not
@Injectable()
export class AddTeamMembersGuard implements CanActivate {
  private readonly logger = new Logger(AddTeamMembersGuard.name);

  constructor(
    private readonly userService: UserService,
    private readonly teamService: TeamsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;
    if (!user) {
      this.logger.error(`No user found in the request`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User found in the request: ${user.email}`);

    const userDetails = await this.userService.getUserWithBusiness(user.email);
    if (!userDetails) {
      this.logger.error(`User details not found for ${user.email}`);
      throw new UnauthorizedException('Invalid user');
    }

    const teamId = body.team_id;
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    const teamDetails = await this.teamService.findOne(teamId);
    if (!teamDetails) {
      this.logger.error(`Team not found: ${teamId}`);
      throw new BadRequestException('Invalid team ID');
    }

    if (teamDetails.business.business_id !== userDetails.business.business_id) {
      this.logger.error(
        `User and team are not in the same business: ${user.email} and team ${teamId}`,
      );
      throw new UnauthorizedException(
        'User is not authorized to add members to this team',
      );
    }
    this.logger.log(`Team validated and belongs to same business`);

    if (body.members && Array.isArray(body.members) && body.members.length > 0) {
      this.logger.log(`Checking ${body.members.length} team members`);

      for (const memberId of body.members) {
        const memberDetails = await this.userService.findOne(memberId);
        if (!memberDetails) {
          this.logger.error(`Member not found: ${memberId}`);
          throw new UnauthorizedException(`Member with ID ${memberId} not found`);
        }

        if (
          memberDetails.business.business_id !== userDetails.business.business_id
        ) {
          this.logger.error(
            `Member ${memberDetails.email} does not belong to the same business as ${user.email}`,
          );
          throw new UnauthorizedException(
            `Member ${memberDetails.email} is not in the same business`,
          );
        }

        this.logger.log(
          `Member ${memberDetails.email} belongs to the same business`,
        );
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

  constructor(
    private readonly userService: UserService,
    private readonly teamService: TeamsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;

    if (!user) {
      this.logger.error(`No user found in the request`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User found in the request: ${user.email}`);

    // fetch full user details with business
    const userDetails = await this.userService.getUserWithBusiness(user.email);
    if (!userDetails) {
      this.logger.error(`User details not found for ${user.email}`);
      throw new UnauthorizedException('Invalid user');
    }

    // validate team
    const teamId = body.team_id;
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    const teamDetails = await this.teamService.findOne(teamId);
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
    if (body.members && Array.isArray(body.members) && body.members.length > 0) {
      this.logger.log(`Checking ${body.members.length} team members for team ${teamId}`);
    
      // Get all members currently in the team
      const existingTeamMembers = await this.teamService.findTeamMember(teamId);
    
      const existingMemberIds = existingTeamMembers.map((tm) => tm.user.user_id);
    
      for (const memberId of body.members) {
        // check if this member exists in the team
        if (!existingMemberIds.includes(memberId)) {
          this.logger.error(`Member with ID ${memberId} is not part of team ${teamId}`);
          throw new BadRequestException(
            `Member with ID ${memberId} is not part of the specified team`,
          );
        }
    
        // optional: check business consistency using one of the loaded relations
        const member = existingTeamMembers.find((tm) => tm.user.user_id === memberId);
        console.log('member.user', member.user);
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







