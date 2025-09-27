import { Injectable } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMembersDto, UpdateTeamDto, UpdateTeamNameDto } from './dto/update-team.dto';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';
import { Repository } from 'typeorm';
import { TeamMember } from './entities/team_members.entity';
import { UserService } from 'src/user/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';

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
        business: leader.business,
        leader
        
      }
      const team = this.teamRepository.create(obj);
      const result = await this.teamRepository.save(team);
      this.logger.log(`Team created successfully: ${result.name}`);

      await this.addMembers(team, createTeamDto.members);

      const data = await this.findOne(result.id);
      return {
        message: 'Team created successfully', 
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
          relations:['leader']
        }
      ); 
      return{
        message: "Teams found successfully",
        teams
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
        message: "Team found successfully",
        team
      }
    } catch (error) {
      this.logger.error(`Error getting team details: ${id}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // This function updates team name
  async updateTeamName(updateTeamDto: UpdateTeamNameDto) {
    const {id, name} = updateTeamDto;
    try {
      this.logger.log(`Initiating to update team name: ${id}`);
      const team = await this.findOne(id);
      team.name = name;
      await this.teamRepository.save(team);
      return {message: 'Team name updated successfully', team};

    } catch (error) {
      this.logger.error(`Error updating team name: ${id}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // This function updates team members (add)
  async updateMembers(addMembersDto: AddMembersDto) {
    this.logger.log(`Initiating to update team members: ${addMembersDto.team_id}`);
    const {team_id, members} = addMembersDto;

    try {
      this.logger.log(`Getting team: ${team_id}`);
      const team = await this.findOne(team_id);
      this.logger.log(`Team found: ${team.name}`);

      this.logger.log(`Adding members to team: ${team.name}`);
      const operation = this.addMembers(team, members);


      if (!operation) {
        this.logger.error("Something went wrong while adding members.");
        throw new HttpException("Something went wrong while adding members.", HttpStatus.INTERNAL_SERVER_ERROR);
      }
      this.logger.log(`Members added successfully to team: ${team.name}`);
      return {message: 'Members added successfully', team};

    } catch (error) {
      this.logger.error(`Error adding members to team: ${team_id}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    
  };

  // This function removes members from team
  async removeMembers(addMembersDto: AddMembersDto) {
    const { team_id, members } = addMembersDto;
  
    try {
      // 1. Load the team with its current members
      const team = await this.teamRepository.findOne({
        where: { id: team_id },
        relations: ['members', 'members.user'],
      });
  
      // 2. Filter out only the members that exist in this team
      const membersToRemove = team.members.filter((tm) =>
        members.includes(tm.user.user_id),
      );
  
      if (membersToRemove.length === 0) {
        this.logger.warn(`No valid members found to remove in team: ${team_id}`);
        throw new HttpException(
          'No valid members found in this team to remove',
          HttpStatus.BAD_REQUEST,
        );
      }
  
      // 3. Remove members from team_members table
      await this.teamMemberRepository.remove(membersToRemove);
  
      this.logger.log(
        `Removed ${membersToRemove.length} members from team: ${team.name}`,
      );
  
      return {
        message: `Successfully removed ${membersToRemove.length} members from team`,
        removedMembers: membersToRemove.map((tm) => tm.user.user_id),
      };
    } catch (error) {
      this.logger.error(
        `Error removing members from team: ${team_id}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
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
}
