import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';
import { In, Repository } from 'typeorm';
import { TeamMember } from './entities/team_members.entity';
import { UserService } from '../user/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TaskStatus } from 'src/projects/entities/task.entity';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    private readonly userService: UserService,
  ){}
  
  // Create new team
  async create(createTeamDto: CreateTeamDto) {
    this.logger.log(`Creating a new team: ${createTeamDto.name}`);
    try {
      this.logger.log(`Finding leader for team: ${createTeamDto.name}`);
      const leader = await this.userService.findOne(createTeamDto.leader_id);
      const obj = {
        name: createTeamDto.name,
        description: createTeamDto.description,
        business: leader.business,
        leader
        
      }
      const team = this.teamRepository.create(obj);
      const result = await this.teamRepository.save(team);
      this.logger.log(`Team created successfully: ${result.name}`);

      await this.addMembers(team, createTeamDto.members);

      const data = await this.findOne(result.id);
      return { 
        data
      }

    } catch (error) {
      this.logger.error(`Error creating team: ${createTeamDto.name}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Get all teams for business
  async findAll(obj: any) {
    try {
      this.logger.log(`Initiating to get team list`);
      this.logger.log(`Getting user: ${obj.email}`);
      const user = await this.userService.getUserWithBusiness(obj.email);
      this.logger.log(`User found: ${user.email}`);
      
      this.logger.log(`Getting teams for user: ${user.email}`);
      const teams = await this.teamRepository.find(
        { 
          where: {business: {business_id: user.business.business_id}},
          relations:['leader', 'members', 'members.user']
        }
      ); 

      const teamsWithMembers = teams.map((team) => ({
        ...team,
        teamMembers: team.members.map((member) => member.user),
      }));

      this.logger.log(`Found ${teamsWithMembers.length} teams with member details for user: ${user.email}`);
      return{
        count: teamsWithMembers.length,
        teams: teamsWithMembers
      }
    } catch (error) {
      this.logger.error(`Error getting teams for user: ${obj.email}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  };

  // This function gets team details
  async getTeamDetails(id: string) {
    try {
      this.logger.log(`Initiating to get team details`);
      this.logger.log(`Getting team: ${id}`);
      const team = await this.findOne(id);
      this.logger.log(`Team found: ${team.name}`);
      return {
        team
      }
    } catch (error) {
      this.logger.error(`Error getting team details: ${id}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async getTeamProgress(id: string) {
    try {
      this.logger.log(`Initiating to get team progress: ${id}`);
      const team = await this.teamRepository.findOne({
        where: { id },
        relations: ['business', 'projects', 'projects.tasks', 'tasks'],
      });

      if (!team) {
        this.logger.error(`Team not found for progress: ${id}`);
        throw new HttpException('Invalid team ID', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Calculating project and task progress for team: ${id}`);
      const projectTasks = team.projects.flatMap((project) => project.tasks ?? []);
      const directTasks = team.tasks ?? [];

      const uniqueTasks = Array.from(
        new Map([...projectTasks, ...directTasks].map((task) => [task.id, task])).values(),
      );

      const statusCounts = {
        todo: 0,
        in_progress: 0,
        review: 0,
        completed: 0,
      };

      for (const task of uniqueTasks) {
        if (task.status === TaskStatus.TODO) {
          statusCounts.todo += 1;
        } else if (task.status === TaskStatus.IN_PROGRESS) {
          statusCounts.in_progress += 1;
        } else if (task.status === TaskStatus.REVIEW) {
          statusCounts.review += 1;
        } else if (task.status === TaskStatus.COMPLETED) {
          statusCounts.completed += 1;
        }
      }

      const totalTasks = uniqueTasks.length;
      const progress =
        totalTasks > 0
          ? Number((((statusCounts.review + statusCounts.completed) / totalTasks) * 100).toFixed(2))
          : 0;

      this.logger.log(`Team progress calculated successfully: ${id}`);
      return {
        teamId: team.id,
        teamName: team.name,
        totalProjects: team.projects.length,
        totalTasks,
        todoTasks: statusCounts.todo,
        inProgressTasks: statusCounts.in_progress,
        reviewTasks: statusCounts.review,
        completedTasks: statusCounts.completed,
        progress,
      };
    } catch (error) {
      this.logger.error(`Error getting team progress: ${id}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // This function updates team name
  async updateTeam(updateTeamDto: UpdateTeamDto) {
    try {
      this.logger.log(`Initiating to update team name: ${updateTeamDto.id}`);
      const team = await this.findOne(updateTeamDto.id);
      team.name = updateTeamDto.name;
      team.description = updateTeamDto.description;
      await this.teamRepository.save(team);
      await this.updateMembers(team, updateTeamDto.members)
      return {message: 'Team name updated successfully', team};

    } catch (error) {
      this.logger.error(`Error updating team name: ${updateTeamDto.id}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // This function updates team members (add)
  async updateMembers(team: Team, desiredUserIds: number[]) {
    this.logger.log(`Initiating to sync team members for team: ${team.id}`);
    try {
      const currentTeamMembers = await this.teamMemberRepository.find({
        where: { team: { id: team.id } },
        relations: ['user'],
      });
      const currentUserIds = currentTeamMembers.map(tm => tm.user.user_id);
      const userIdsToAdd = desiredUserIds.filter(id => !currentUserIds.includes(id));
      const teamMembersToRemove = currentTeamMembers.filter(
        tm => !desiredUserIds.includes(tm.user.user_id)
      );
      
      if (userIdsToAdd.length > 0) {
        this.logger.log(`Adding members ${userIdsToAdd.length} ids.`);
        await this.addMembers(team, userIdsToAdd);
      }

      if (teamMembersToRemove.length > 0) {
        const userIdsToRemove = teamMembersToRemove.map(tm => tm.user.user_id);
        this.logger.log(`Removing members: [${userIdsToRemove.join(', ')}]`);
        await this.teamMemberRepository.remove(teamMembersToRemove);
      }

      if (userIdsToAdd.length === 0 && teamMembersToRemove.length === 0) {
        this.logger.log(`No member changes required for team: ${team.name}`);
      }
      
      this.logger.log(`Members synced successfully for team: ${team.name}`);
      return { message: 'Members updated successfully', team };

    } catch (error) {
      this.logger.error(`Error syncing members for team: ${team.id}`, error.stack); 
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // This function removes members from team
  async removeMembers(team_id: string, memberUserIds: number[]) {
    try {
      this.logger.log(`Initiating removal of members from team: ${team_id}`);

      // 1. Find the team and its current member entries (TeamMember)
      const team = await this.teamRepository.findOne({
        where: { id: team_id },
        relations: ['members', 'members.user'], 
      });

      if (!team) {
        this.logger.warn(`Team not found: ${team_id}`);
        throw new NotFoundException(`Team with ID ${team_id} not found`);
      }
      
      const membersToRemove = team.members.filter((teamMember) =>
        memberUserIds.includes(teamMember.user.user_id),
      );

      if (membersToRemove.length === 0) {
        this.logger.warn(`No valid members found to remove in team: ${team_id}`);
        throw new HttpException(
          'None of the provided members were found in this team',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 5. Remove the TeamMember join-table entries
      await this.teamMemberRepository.remove(membersToRemove);

      const removedIds = membersToRemove.map((tm) => tm.user.user_id);
      this.logger.log(
        `Removed ${membersToRemove.length} members [${removedIds.join(', ')}] from team: ${team.name}`,
      );

      return {
        message: `Successfully removed ${membersToRemove.length} members from team`,
        removedMemberIds: removedIds,
      };

    } catch (error) {
      this.logger.error(
        `Error removing members from team: ${team_id}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'An error occurred while removing members',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // This function deletes team.
  async removeTeam(id: string) {
    this.logger.log(`Initiating to delete team: ${id}`);
    try {
      this.logger.log(`Getting team: ${id}`);
      const team = await this.findOne(id);
      if (!team) {
        this.logger.error(`Team not found: ${id}`);
        throw new HttpException('Invalid team ID', HttpStatus.BAD_REQUEST);
      }
      this.logger.log(`Deleting team: ${id}`);

      this.logger.log(`Deleting team members: ${id}`);
      await this.teamRepository.delete(id);
      this.logger.log(`Team deleted successfully: ${id}`);
      return {message: 'Team deleted successfully'};
    } catch (error) {
      this.logger.error(`Error deleting team: ${id}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }



  // Helper Functions

  findOne(id: string) {
    return this.teamRepository.findOne({where: {id}, relations:['leader','business', 'members', 'members.user']});
  }

  async findTeamMember(teamId: string){
    const existingTeamMembers = await this.teamMemberRepository.find({
      where: { team: { id: teamId } },
      relations: ['user','user.business'],
    });
    return existingTeamMembers;
  }

  async findTeamsForUser(userId: number) {
    const teamMembers = await this.teamMemberRepository.find({
      where: { user: { user_id: userId } },
      relations: ['team'],
    });
    return teamMembers.map(tm => tm.team);
  }

  async addMembers(team: Team, members: number[]) {
    if (members && members.length > 0) {
      this.logger.log(`Adding ${members.length} members to team: ${team.name}`);
  
      for (const memberId of members) {
        const memberUser = await this.userService.findOne(memberId);
  
        // no need to re-check existence or business because guard already did that
        const teamMember = this.teamMemberRepository.create({
          user: memberUser,
          team,
        });
        await this.teamMemberRepository.save(teamMember);
      }
    }
    return true; 
  }

  async findTeams(teamIds: string[]) {
    const teams = await this.teamRepository.find({where: {id: In(teamIds)}});
    return teams;
  }

  async findValidTeams(teamIds: string[], businessId: number): Promise<boolean> {
  for (const id of teamIds) {
    const team = await this.teamRepository.findOne({ where: { id }, relations: ['business'] });
    if (!team || team.business.business_id !== businessId) {
      return false;
    }
  }
  return true;
}

  async findValidTeam(teamId: string, businessId: number): Promise<boolean> {
    const team = await this.teamRepository.findOne({ where: { id: teamId }, relations: ['business'] });
    if (!team || team.business.business_id !== businessId) {
      return false;
    }
    return true;
  }

}
