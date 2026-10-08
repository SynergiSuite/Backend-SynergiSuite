import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Group, GroupType } from '../collab_station/entities/group.entity';
import {
  GroupMember,
  GroupMemberRole,
} from '../collab_station/entities/group-member.entity';
import { TaskStatus } from '../projects/entities/task.entity';
import { UserHelper } from '../user/user.helper';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team_members.entity';

@Injectable()
export class TeamsHelper {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    private readonly userHelper: UserHelper,
  ) {}

  async getUserWithBusiness(email: string) {
    const user = await this.userHelper.getUserWithBusinessDetail(email);

    if (!user?.business?.business_id) {
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    return user;
  }

  async findUserById(userId: number) {
    return await this.userHelper.findOne(userId);
  }

  async createTeam(createTeamDto: CreateTeamDto, leader: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const teamToCreate = this.teamRepository.create({
        name: createTeamDto.name,
        description: createTeamDto.description,
        business: leader.business,
        leader,
      });

      const savedTeam = await queryRunner.manager.save(teamToCreate);

      const group = queryRunner.manager.create(Group, {
        name: savedTeam.name,
        type: GroupType.TEAM,
        teamId: savedTeam.id,
        createdById: createTeamDto.leader_id,
      });
      const savedGroup = await queryRunner.manager.save(Group, group);

      const creatorGroupMember = queryRunner.manager.create(GroupMember, {
        userId: createTeamDto.leader_id,
        groupId: savedGroup.id,
        role: GroupMemberRole.ADMIN,
      });
      await queryRunner.manager.save(GroupMember, creatorGroupMember);

      const memberIds = this.getUniqueMemberIds(createTeamDto.members);
      for (const memberId of memberIds) {
        const memberUser = await this.findUserById(memberId);
        const teamMember = queryRunner.manager.create(TeamMember, {
          user: memberUser,
          team: savedTeam,
        });
        await queryRunner.manager.save(TeamMember, teamMember);

        if (memberId !== createTeamDto.leader_id) {
          const groupMember = queryRunner.manager.create(GroupMember, {
            userId: memberId,
            groupId: savedGroup.id,
            role: GroupMemberRole.MEMBER,
          });
          await queryRunner.manager.save(GroupMember, groupMember);
        }
      }

      await queryRunner.commitTransaction();

      return {
        savedTeam,
        groupId: savedGroup.id,
        memberIds,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllWithTasks(businessId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [teams, totalItems] = await this.teamRepository
      .createQueryBuilder('team')
      .where('team.business_id = :businessId', { businessId })
      .leftJoinAndSelect('team.leader', 'leader')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.user', 'user')
      .leftJoinAndSelect('team.projects', 'projects')
      .leftJoin('team.tasks', 'tasks')
      .addSelect(['tasks.id', 'tasks.status'])
      .skip(skip)
      .take(limit)
      .orderBy('team.name', 'ASC')
      .getManyAndCount();

    const teamsWithMembers = teams.map((team) => {
      const tasks = team.tasks || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(
        (task) => task.status === TaskStatus.COMPLETED,
      ).length;

      return {
        ...team,
        teamMembers: team.members?.map((member) => member.user) || [],
        totalTasks,
        completedTasks,
        ongoingTasks: totalTasks - completedTasks,
        members: undefined,
      };
    });

    return { teamsWithMembers, totalItems };
  }

  async findAll(businessId: number) {
    return await this.teamRepository.find({
      where: { business: { business_id: businessId } },
    });
  }

  async getTeamProgress(id: string) {
    const team = await this.teamRepository
      .createQueryBuilder('team')
      .where('team.id = :id', { id })
      .leftJoin('team.projects', 'projects')
      .addSelect(['projects.id'])
      .leftJoin('team.tasks', 'tasks')
      .addSelect(['tasks.id', 'tasks.status'])
      .getOne();

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    const totalProjects = team.projects?.length || 0;
    const tasks = team.tasks || [];
    const totalTasks = tasks.length;
    const statusCounts = {
      todo: 0,
      in_progress: 0,
      review: 0,
      completed: 0,
    };

    for (const task of tasks) {
      if (task.status === TaskStatus.TODO) statusCounts.todo++;
      else if (task.status === TaskStatus.IN_PROGRESS) {
        statusCounts.in_progress++;
      } else if (task.status === TaskStatus.REVIEW) {
        statusCounts.review++;
      } else if (task.status === TaskStatus.COMPLETED) {
        statusCounts.completed++;
      }
    }

    const progress =
      totalTasks > 0
        ? Number(
            (
              ((statusCounts.review + statusCounts.completed) / totalTasks) *
              100
            ).toFixed(2),
          )
        : 0;

    return {
      team,
      totalProjects,
      totalTasks,
      statusCounts,
      progress,
    };
  }

  async updateTeam(team: Team, updateTeamDto: UpdateTeamDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      team.name = updateTeamDto.name;
      team.description = updateTeamDto.description;

      const savedTeam = await queryRunner.manager.save(team);
      const memberIds = await this.updateMembers(
        savedTeam.id,
        updateTeamDto.members || [],
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
      return { savedTeam, memberIds };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateMembers(
    teamId: string,
    desiredUserIds: number[],
    manager: EntityManager,
  ): Promise<number[]> {
    const currentTeamMembers = await manager.find(
      this.teamMemberRepository.target,
      {
        where: { team: { id: teamId } },
        relations: ['user'],
        select: { id: true, user: { user_id: true } },
      },
    );

    const currentUserIds = currentTeamMembers.map((tm) => tm.user.user_id);
    const currentSet = new Set(currentUserIds);
    const desiredSet = new Set(desiredUserIds);

    const userIdsToAdd = desiredUserIds.filter((id) => !currentSet.has(id));
    const teamMembersToRemove = currentTeamMembers.filter(
      (tm) => !desiredSet.has(tm.user.user_id),
    );

    if (teamMembersToRemove.length > 0) {
      await manager.remove(teamMembersToRemove);
    }

    if (userIdsToAdd.length > 0) {
      const newMembers = userIdsToAdd.map((userId) =>
        manager.create(this.teamMemberRepository.target, {
          team: { id: teamId },
          user: { user_id: userId },
        }),
      );

      await manager.save(newMembers);
    }

    return desiredUserIds;
  }

  async addTeamMember(team: Team, user: any) {
    const teamMember = this.teamMemberRepository.create({
      user,
      team,
    });

    return await this.teamMemberRepository.save(teamMember);
  }

  async removeTeam(id: string) {
    await this.teamRepository.delete(id);
  }

  async findOne(id: string) {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: ['leader', 'business', 'members', 'members.user'],
      select: {
        id: true,
        name: true,
        description: true,
        leader: {
          user_id: true,
          email: true,
          name: true,
          password_hash: false,
          token_digest: false,
        },
        business: {
          business_id: true,
          name: true,
        },
        members: {
          id: true,
          user: {
            user_id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async findTeamMember(teamId: string) {
    return await this.teamMemberRepository.find({
      where: { team: { id: teamId } },
      relations: ['user', 'user.business'],
    });
  }

  async findTeamsForUser(userId: number) {
    const teamMembers = await this.teamMemberRepository.find({
      where: { user: { user_id: userId } },
      relations: ['team'],
    });

    return teamMembers.map((tm) => tm.team);
  }

  async findTeams(teamIds: string[]) {
    return await this.teamRepository.find({
      where: { id: In(teamIds) },
      relations: ['business'],
    });
  }

  async findValidTeams(teamIds: string[], businessId: number) {
    const teams = await this.findTeams(teamIds);
    return (
      teams.length === teamIds.length &&
      teams.every((team) => team.business?.business_id === businessId)
    );
  }

  async findValidTeam(teamId: string, businessId: number) {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['business'],
    });

    return Boolean(team && team.business.business_id === businessId);
  }

  async getTeamDetailsForUser(empId: number) {
    return await this.teamMemberRepository
      .createQueryBuilder('tm')
      .innerJoin('tm.user', 'employee')
      .where('employee.user_id = :employeeId', { employeeId: empId })
      .leftJoinAndSelect('tm.team', 'team')
      .leftJoinAndSelect('team.leader', 'leader')
      .leftJoinAndSelect('team.projects', 'projects')
      .leftJoinAndSelect('team.tasks', 'tasks')
      .select([
        'tm.id',
        'team.id',
        'team.name',
        'team.description',
        'leader.user_id',
        'leader.name',
        'leader.email',
        'projects.id',
        'projects.name',
        'projects.status',
        'projects.duration',
        'tasks.id',
        'tasks.status',
      ])
      .take(15)
      .getMany();
  }

  getUniqueMemberIds(memberIds: number[] = []) {
    return [...new Set(memberIds)];
  }
}
