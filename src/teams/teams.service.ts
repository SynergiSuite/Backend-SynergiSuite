import {
  Injectable,
  Inject,
  forwardRef,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Logger } from '@nestjs/common';
import { Team } from './entities/team.entity';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GroupService } from '../collab_station/services/group.service';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { PaginationParams } from 'src/shared/pagination-params';
import { TeamsHelper } from './teams.helper';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly teamsHelper: TeamsHelper,
    @Inject(forwardRef(() => GroupService))
    private readonly groupService: GroupService,
    private readonly activityService: ActivityService,
  ) {}

  // Create new team
  async create(createTeamDto: CreateTeamDto, reqObj?: any) {
    this.logger.log(`Creating a new team: ${createTeamDto.name}`);

    const [actor, leader] = await Promise.all([
      reqObj?.email
        ? this.teamsHelper.getUserWithBusiness(reqObj.email)
        : Promise.resolve(null),
      this.teamsHelper.findUserById(createTeamDto.leader_id),
    ]);

    if (!leader) {
      throw new HttpException('Leader not found', HttpStatus.NOT_FOUND);
    }

    try {
      const { savedTeam, groupId, memberIds } =
        await this.teamsHelper.createTeam(createTeamDto, leader);
      this.logger.log(`Team created successfully: ${savedTeam.name}`);

      await this.activityService.log({
        action: ActivityAction.CREATED,
        module: 'teams',
        entityType: 'Team',
        entityId: savedTeam.id,
        entityName: savedTeam.name,
        actor: actor ?? leader,
        businessId: leader.business.business_id,
        after: {
          id: savedTeam.id,
          name: savedTeam.name,
          description: savedTeam.description,
          leaderId: leader.user_id,
          memberIds,
          groupId,
        },
      });

      return {
        data: {
          ...savedTeam,
          members: memberIds,
          groupId,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error creating team: ${createTeamDto.name}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create team. Process rolled back.',
      );
    }
  }

  // Get all teams for business
  async findAllWithTasks(
    reqObj: { email: string },
    pagination: PaginationParams = {},
  ) {
    this.logger.log(`Initiating to get team list for user: ${reqObj.email}`);

    // Set defaults if the frontend doesn't provide them
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 5;

    try {
      const user = await this.teamsHelper.getUserWithBusiness(reqObj.email);

      this.logger.log(
        `Getting teams for business ID: ${user.business.business_id} (Page: ${page}, Limit: ${limit})`,
      );

      const { teamsWithMembers, totalItems } =
        await this.teamsHelper.findAllWithTasks(
          user.business.business_id,
          page,
          limit,
        );

      this.logger.log(
        `Returned ${teamsWithMembers.length} teams out of ${totalItems} total`,
      );

      // Return standardized pagination metadata
      return {
        data: teamsWithMembers,
        meta: {
          totalItems,
          itemCount: teamsWithMembers.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(totalItems / limit),
          currentPage: page,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting teams for user: ${reqObj.email}`,
        error.stack,
      );

      if (error.status) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An error occurred while fetching teams',
      );
    }
  }

  async findAll(reqObj: { email: string }) {
    try {
      this.logger.log(`Initiating to get all teams for user: ${reqObj.email}`);
      const user = await this.teamsHelper.getUserWithBusiness(reqObj.email);
      const teams = await this.teamsHelper.findAll(user.business.business_id);
      this.logger.log(`Returned ${teams.length} teams`);
      return { data: teams };
    } catch (error) {
      this.logger.error(
        `Error getting all teams for user: ${reqObj.email}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'An error occurred while fetching teams',
      );
    }
  }

  // This function gets team details
  async getTeamDetails(id: string) {
    this.logger.log(`Initiating request to fetch team details for ID: ${id}`);

    try {
      // Since findOne now handles the 404, we just await it safely
      const team = await this.findOne(id);

      this.logger.log(`Successfully fetched details for team: ${team.name}`);

      return {
        data: team, // 'data' wrapper is standard practice for REST APIs
      };
    } catch (error) {
      this.logger.error(
        `Error getting team details for ID: ${id}`,
        error.stack,
      );

      // Preserve the 404 NotFoundException thrown by findOne
      if (error instanceof HttpException) {
        throw error;
      }

      // Throw 500 for actual unexpected database errors
      throw new InternalServerErrorException('Failed to retrieve team details');
    }
  }

  // This function gets team progress
  async getTeamProgress(id: string) {
    this.logger.log(`Initiating to get team progress: ${id}`);

    try {
      const { team, totalProjects, totalTasks, statusCounts, progress } =
        await this.teamsHelper.getTeamProgress(id);

      this.logger.log(`Calculating project and task progress for team: ${id}`);
      this.logger.log(`Team progress calculated successfully: ${id}`);

      return {
        teamId: team.id,
        teamName: team.name,
        totalProjects,
        totalTasks,
        todoTasks: statusCounts.todo,
        inProgressTasks: statusCounts.in_progress,
        reviewTasks: statusCounts.review,
        completedTasks: statusCounts.completed,
        progress,
      };
    } catch (error) {
      this.logger.error(`Error getting team progress: ${id}`, error.stack);

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'An error occurred while calculating team progress',
      );
    }
  }

  // This function updates team name
  async updateTeam(updateTeamDto: UpdateTeamDto, reqObj?: any) {
    this.logger.log(`Initiating to update team: ${updateTeamDto.id}`);

    const [actor, team] = await Promise.all([
      reqObj?.email
        ? this.teamsHelper.getUserWithBusiness(reqObj.email)
        : Promise.resolve(null),
      this.findOne(updateTeamDto.id),
    ]);

    const before = {
      name: team.name,
      description: team.description,
      memberIds: team.members?.map((member) => member.user.user_id) ?? [],
    };

    try {
      const { savedTeam, memberIds } = await this.teamsHelper.updateTeam(
        team,
        updateTeamDto,
      );

      const after = {
        name: savedTeam.name,
        description: savedTeam.description,
        memberIds,
      };

      await this.activityService.logFieldChanges(
        {
          action: ActivityAction.UPDATED,
          module: 'teams',
          entityType: 'Team',
          entityId: savedTeam.id,
          entityName: savedTeam.name,
          actor: actor ?? team.leader,
          businessId: team.business.business_id,
        },
        before,
        after,
        ['name', 'description', 'memberIds'],
      );

      return {
        message: 'Team updated successfully',
        data: {
          ...savedTeam,
          memberIds,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error updating team: ${updateTeamDto.id}`,
        error.stack,
      );

      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update team');
    }
  }

  // This function deletes team.
  async removeTeam(id: string, reqObj?: any) {
    this.logger.log(`Initiating to delete team: ${id}`);

    const [actor, team] = await Promise.all([
      reqObj?.email
        ? this.teamsHelper.getUserWithBusiness(reqObj.email)
        : Promise.resolve(null),
      this.findOne(id),
    ]);

    const before = {
      id: team.id,
      name: team.name,
      description: team.description,
      leaderId: team.leader?.user_id,
      memberIds: team.members?.map((member) => member.user.user_id) ?? [],
    };

    try {
      this.logger.log(`Executing database deletion for team: ${id}`);

      await this.teamsHelper.removeTeam(id);

      await this.activityService.log({
        action: ActivityAction.DELETED,
        module: 'teams',
        entityType: 'Team',
        entityId: team.id,
        entityName: team.name,
        actor: actor ?? team.leader,
        businessId: team.business.business_id,
        before,
      });

      this.logger.log(`Team deleted successfully: ${id}`);

      return { message: 'Team deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting team: ${id}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An error occurred while deleting the team',
      );
    }
  }

  // Helper Functions

  async findOne(id: string) {
    return await this.teamsHelper.findOne(id);
  }

  async findTeamMember(teamId: string) {
    return await this.teamsHelper.findTeamMember(teamId);
  }

  async findTeamsForUser(userId: number) {
    return await this.teamsHelper.findTeamsForUser(userId);
  }

  async addMembers(team: Team, members: number[]) {
    if (members && members.length > 0) {
      this.logger.log(`Adding ${members.length} members to team: ${team.name}`);

      for (const memberId of members) {
        const memberUser = await this.teamsHelper.findUserById(memberId);

        // no need to re-check existence or business because guard already did that
        await this.teamsHelper.addTeamMember(team, memberUser);

        // Sync to collab_station group
        await this.groupService.addMemberByTeamId(team.id, memberId);
      }
    }
    return true;
  }

  async findTeams(teamIds: string[]) {
    return await this.teamsHelper.findTeams(teamIds);
  }

  async findValidTeams(
    teamIds: string[],
    businessId: number,
  ): Promise<boolean> {
    return await this.teamsHelper.findValidTeams(teamIds, businessId);
  }

  async findValidTeam(teamId: string, businessId: number): Promise<boolean> {
    return await this.teamsHelper.findValidTeam(teamId, businessId);
  }

  async getTeamDetailsForUser(employeeId: number) {
    return this.teamsHelper.getTeamDetailsForUser(employeeId);
  }
}
