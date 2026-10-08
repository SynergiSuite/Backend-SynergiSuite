import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group, GroupType } from '../entities/group.entity';
import { GroupMember, GroupMemberRole } from '../entities/group-member.entity';
import { Call, CallStatus } from '../entities/call.entity';
import { CreateGroupDto } from '../dto/create-group.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { toCallResponseDto } from '../dto/call.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { CollabStationHelper } from '../collab_station.helper';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    @InjectRepository(Call)
    private readonly callRepository: Repository<Call>,
    private readonly collabStationHelper: CollabStationHelper,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  // Create a custom group and add creator as admin
  async createCustomGroup(
    dto: CreateGroupDto,
    createdById: number,
    createdByName: string = 'An admin',
    businessId?: number,
  ) {
    this.logger.log(`Creating custom group: ${dto.name}`);
    const requestedMemberIds = dto.members || [];
    const memberIds = requestedMemberIds.filter(
      (userId) => userId !== createdById,
    );
    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length !== memberIds.length) {
      throw new HttpException(
        'Duplicate user IDs are not allowed',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertUsersBelongToBusiness(uniqueMemberIds, businessId);

    try {
      const savedGroup = await this.groupRepository.manager.transaction(
        async (manager) => {
          const group = manager.create(Group, {
            name: dto.name,
            type: GroupType.CUSTOM,
            description: dto.description,
            avatarUrl: dto.avatarUrl,
            createdById,
          });
          const createdGroup = await manager.save(Group, group);

          const creatorMember = manager.create(GroupMember, {
            userId: createdById,
            groupId: createdGroup.id,
            role: GroupMemberRole.ADMIN,
          });
          await manager.save(GroupMember, creatorMember);

          if (uniqueMemberIds.length) {
            const members = uniqueMemberIds.map((userId) =>
              manager.create(GroupMember, {
                userId,
                groupId: createdGroup.id,
                role: GroupMemberRole.MEMBER,
              }),
            );
            await manager.save(GroupMember, members);
          }

          this.logger.log(
            `Custom group created successfully: ${createdGroup.id}`,
          );
          return manager.findOne(Group, {
            where: { id: createdGroup.id },
            relations: ['members', 'members.user'],
          });
        },
      );

      if (savedGroup && uniqueMemberIds.length) {
        this.notificationsService
          ?.createMany(
            uniqueMemberIds.map((recipientId) => ({
              recipientId,
              actorId: createdById,
              type: NotificationType.GROUP_MEMBER_ADDED,
              title: `Added to ${savedGroup.name}`,
              body: `${createdByName} added you to a group`,
              data: {
                groupId: savedGroup.id,
                href: '/collab-station',
              },
            })),
          )
          .catch((error) => {
            this.logger.error(
              `Failed to create group notifications for ${savedGroup.id}`,
              error.stack ?? error.message,
            );
          });
      }

      return savedGroup;
    } catch (error) {
      this.logger.error(
        `Error creating custom group: ${dto.name}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Create a direct chat between two users (or return existing one)
  async createDirectChat(
    userAId: number,
    userBId: number,
    businessId?: number,
  ) {
    this.logger.log(
      `Creating direct chat between users: ${userAId} and ${userBId}`,
    );
    try {
      await this.assertUsersBelongToBusiness([userBId], businessId);

      // Check if a direct group already exists between these two users
      const existing = await this.groupMemberRepository
        .createQueryBuilder('gma')
        .innerJoin('group_members', 'gmb', 'gma."groupId" = gmb."groupId"')
        .innerJoin('groups', 'g', 'g.id = gma."groupId"')
        .where('gma."userId" = :userAId', { userAId })
        .andWhere('gmb."userId" = :userBId', { userBId })
        .andWhere('g.type = :type', { type: GroupType.DIRECT })
        .select('g.id', 'groupId')
        .getRawOne();

      if (existing) {
        this.logger.log(`Direct chat already exists: ${existing.groupId}`);
        const group = await this.groupRepository.findOne({
          where: { id: existing.groupId },
          relations: ['members', 'members.user'],
        });
        return group;
      }

      // Create new direct chat
      const group = this.groupRepository.create({
        name: null,
        type: GroupType.DIRECT,
      });
      const savedGroup = await this.groupRepository.save(group);

      const memberA = this.groupMemberRepository.create({
        userId: userAId,
        groupId: savedGroup.id,
        role: GroupMemberRole.MEMBER,
      });
      const memberB = this.groupMemberRepository.create({
        userId: userBId,
        groupId: savedGroup.id,
        role: GroupMemberRole.MEMBER,
      });
      await this.groupMemberRepository.save([memberA, memberB]);

      this.logger.log(`Direct chat created successfully: ${savedGroup.id}`);
      return await this.groupRepository.findOne({
        where: { id: savedGroup.id },
        relations: ['members', 'members.user'],
      });
    } catch (error) {
      this.logger.error(`Error creating direct chat`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Find all groups for a user with latest message
  async findAllForUser(userId: number, businessId: number) {
    this.logger.log(`Finding all groups for user: ${userId}`);
    try {
      const memberships = await this.groupMemberRepository.find({
        where: { userId },
        relations: ['group'],
      });

      const groups = [];
      for (const membership of memberships) {
        const group = await this.groupRepository
          .createQueryBuilder('group')
          .leftJoinAndSelect('group.members', 'members')
          .leftJoinAndSelect('members.user', 'user')
          .leftJoinAndSelect('user.business', 'memberBusiness')
          .leftJoinAndSelect('group.project', 'project')
          .leftJoinAndSelect('project.business', 'projectBusiness')
          .leftJoinAndSelect('group.team', 'team')
          .leftJoinAndSelect('team.business', 'teamBusiness')
          .leftJoinAndSelect('group.createdBy', 'createdBy')
          .leftJoinAndSelect('createdBy.business', 'createdByBusiness')
          .where('group.id = :groupId', { groupId: membership.groupId })
          .getOne();

        if (!group || !this.groupBelongsToBusiness(group, businessId)) {
          continue;
        }

        // Get the latest message for this group
        const latestMessage = await this.groupRepository.manager
          .createQueryBuilder()
          .select('m')
          .from('messages', 'm')
          .where('m."groupId" = :groupId', { groupId: membership.groupId })
          .andWhere('m."deletedAt" IS NULL')
          .orderBy('m."createdAt"', 'DESC')
          .limit(1)
          .getRawOne();

        const missedCalls = await this.callRepository.find({
          where: {
            groupId: membership.groupId,
            recipientId: userId,
            status: CallStatus.MISSED,
          },
          relations: ['caller', 'recipient'],
          order: { createdAt: 'DESC' },
        });

        groups.push({
          ...group,
          latestMessage: latestMessage || null,
          missedCalls: missedCalls.map((call) => toCallResponseDto(call)),
          missedCallCount: missedCalls.length,
          isMuted: membership.isMuted,
          myRole: membership.role,
        });
      }

      this.logger.log(
        `Found ${groups.length} groups for user: ${userId} and business: ${businessId}`,
      );
      return groups;
    } catch (error) {
      this.logger.error(
        `Error finding groups for user: ${userId}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async findGroupIdsForUser(
    userId: number,
    businessId?: number,
  ): Promise<string[]> {
    this.logger.log(`Finding group IDs for user: ${userId}`);
    const memberships = await this.groupMemberRepository.find({
      where: { userId },
      select: ['groupId'],
    });

    if (!businessId) {
      return memberships.map((membership) => membership.groupId);
    }

    const groupIds: string[] = [];
    for (const membership of memberships) {
      const group = await this.groupRepository
        .createQueryBuilder('group')
        .leftJoinAndSelect('group.members', 'members')
        .leftJoinAndSelect('members.user', 'user')
        .leftJoinAndSelect('user.business', 'memberBusiness')
        .leftJoinAndSelect('group.project', 'project')
        .leftJoinAndSelect('project.business', 'projectBusiness')
        .leftJoinAndSelect('group.team', 'team')
        .leftJoinAndSelect('team.business', 'teamBusiness')
        .leftJoinAndSelect('group.createdBy', 'createdBy')
        .leftJoinAndSelect('createdBy.business', 'createdByBusiness')
        .where('group.id = :groupId', { groupId: membership.groupId })
        .getOne();

      if (group && this.groupBelongsToBusiness(group, businessId)) {
        groupIds.push(membership.groupId);
      }
    }

    return groupIds;
  }

  async findOneForUser(groupId: string, userId: number, businessId: number) {
    this.logger.log(`Finding group ${groupId} for user: ${userId}`);
    const member = await this.groupMemberRepository.findOne({
      where: { groupId, userId },
    });

    if (!member) {
      throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
    }

    const group = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.members', 'members')
      .leftJoinAndSelect('members.user', 'user')
      .leftJoinAndSelect('user.business', 'memberBusiness')
      .leftJoinAndSelect('group.project', 'project')
      .leftJoinAndSelect('project.business', 'projectBusiness')
      .leftJoinAndSelect('group.team', 'team')
      .leftJoinAndSelect('team.business', 'teamBusiness')
      .leftJoinAndSelect('group.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.business', 'createdByBusiness')
      .where('group.id = :groupId', { groupId })
      .getOne();

    if (!group || !this.groupBelongsToBusiness(group, businessId)) {
      throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
    }

    return group;
  }

  // Find a group by ID with members
  async findOneById(groupId: string) {
    this.logger.log(`Finding group: ${groupId}`);
    try {
      const group = await this.groupRepository.findOne({
        where: { id: groupId },
        relations: ['members', 'members.user'],
      });

      if (!group) {
        throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
      }

      return group;
    } catch (error) {
      this.logger.error(`Error finding group: ${groupId}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Add a member to a custom group
  async addMember(
    groupId: string,
    userId: number,
    role: GroupMemberRole = GroupMemberRole.MEMBER,
  ) {
    this.logger.log(`Adding member ${userId} to group ${groupId}`);
    try {
      const group = await this.groupRepository.findOne({
        where: { id: groupId },
      });
      if (!group) {
        throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
      }

      // Check if already a member
      const existing = await this.groupMemberRepository.findOne({
        where: { userId, groupId },
      });
      if (existing) {
        throw new HttpException(
          'User is already a member of this group',
          HttpStatus.BAD_REQUEST,
        );
      }

      const member = this.groupMemberRepository.create({
        userId,
        groupId,
        role,
      });
      await this.groupMemberRepository.save(member);

      this.logger.log(
        `Member ${userId} added to group ${groupId} successfully`,
      );
      return member;
    } catch (error) {
      this.logger.error(
        `Error adding member to group: ${groupId}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async addMembers(
    groupId: string,
    userIds: number[],
    addedById?: number,
    addedByName: string = 'An admin',
    businessId?: number,
  ) {
    this.logger.log(
      `Adding members [${userIds.join(', ')}] to group ${groupId}`,
    );
    // To be added in guard
    if (!userIds?.length) {
      throw new HttpException('No user IDs provided', HttpStatus.BAD_REQUEST);
    }

    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length !== userIds.length) {
      throw new HttpException(
        'Duplicate user IDs are not allowed',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertUsersBelongToBusiness(uniqueUserIds, businessId);

    const result = await this.groupMemberRepository.manager
      .transaction(async (manager) => {
        const group = await manager.findOne(Group, { where: { id: groupId } });
        // To be added in guard
        if (!group) {
          throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
        }

        // To be added in guard
        const existingMembers = await manager.find(GroupMember, {
          where: { groupId, userId: In(uniqueUserIds) },
        });

        if (existingMembers.length) {
          const existingUserIds = existingMembers
            .map((m) => m.userId)
            .join(', ');
          throw new HttpException(
            `Users are already members of this group: ${existingUserIds}`,
            HttpStatus.BAD_REQUEST,
          );
        }

        const members = uniqueUserIds.map((userId) =>
          manager.create(GroupMember, {
            userId: Number(userId),
            groupId,
            role: GroupMemberRole.MEMBER,
          }),
        );

        const saved = await manager.save(GroupMember, members);
        this.logger.log(`Members added to group ${groupId} successfully`);
        return { saved, group };
      })
      .catch((error) => {
        if (error instanceof HttpException) {
          throw error;
        }
        this.logger.error(
          `Error adding members to group ${groupId}`,
          error.stack ?? error.message,
        );
        throw new HttpException(
          'Failed to add members to group',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });

    this.notificationsService
      ?.createMany(
        uniqueUserIds.map((recipientId) => ({
          recipientId,
          actorId: addedById,
          type: NotificationType.GROUP_MEMBER_ADDED,
          title: `Added to ${result.group.name}`,
          body: `${addedByName} added you to a group`,
          data: {
            groupId,
            href: '/collab-station',
          },
        })),
      )
      .catch((error) => {
        this.logger.error(
          `Failed to create member notifications for group ${groupId}`,
          error.stack ?? error.message,
        );
      });

    return result.saved;
  }

  async deleteGroup(groupId: string) {
    this.logger.log(`Deleting group ${groupId}`);
    try {
      return await this.groupRepository.manager.transaction(async (manager) => {
        const group = await manager.findOne(Group, { where: { id: groupId } });
        if (!group) {
          throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
        }

        if (group.type !== GroupType.CUSTOM) {
          throw new HttpException(
            'Only custom groups can be deleted',
            HttpStatus.BAD_REQUEST,
          );
        }

        await manager.remove(Group, group);
        this.logger.log(`Group deleted successfully: ${groupId}`);
        return { message: 'Group deleted successfully' };
      });
    } catch (error) {
      this.logger.error(`Error deleting group: ${groupId}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Remove a member from a custom group only
  async removeMember(groupId: string, userId: number) {
    this.logger.log(`Removing member ${userId} from group ${groupId}`);
    try {
      const group = await this.groupRepository.findOne({
        where: { id: groupId },
      });
      if (!group) {
        throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
      }
      if (group.type !== GroupType.CUSTOM) {
        throw new HttpException(
          'Members can only be removed from custom groups',
          HttpStatus.BAD_REQUEST,
        );
      }

      const member = await this.groupMemberRepository.findOne({
        where: { userId, groupId },
      });
      if (!member) {
        throw new HttpException(
          'User is not a member of this group',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.groupMemberRepository.remove(member);
      this.logger.log(
        `Member ${userId} removed from group ${groupId} successfully`,
      );
      return { message: 'Member removed successfully' };
    } catch (error) {
      this.logger.error(
        `Error removing member from group: ${groupId}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Update a custom group (name/description/avatar)
  async updateGroup(groupId: string, dto: UpdateGroupDto) {
    this.logger.log(`Updating group: ${groupId}`);
    try {
      const group = await this.groupRepository.findOne({
        where: { id: groupId },
      });
      if (!group) {
        throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
      }
      if (group.type !== GroupType.CUSTOM) {
        throw new HttpException(
          'Only custom groups can be updated',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (dto.name !== undefined) group.name = dto.name;
      if (dto.description !== undefined) group.description = dto.description;
      if (dto.avatarUrl !== undefined) group.avatarUrl = dto.avatarUrl;

      const updated = await this.groupRepository.save(group);
      this.logger.log(`Group updated successfully: ${groupId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error updating group: ${groupId}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // --- Internal helpers for Team/Project integration ---

  // Create a group linked to a team
  async createGroupForTeam(
    teamId: string,
    teamName: string,
    createdById: number,
  ) {
    this.logger.log(`Creating group for team: ${teamId}`);
    try {
      const group = this.groupRepository.create({
        name: teamName,
        type: GroupType.TEAM,
        teamId,
        createdById,
      });
      const savedGroup = await this.groupRepository.save(group);

      // Add creator as admin
      const member = this.groupMemberRepository.create({
        userId: createdById,
        groupId: savedGroup.id,
        role: GroupMemberRole.ADMIN,
      });
      await this.groupMemberRepository.save(member);

      this.logger.log(`Group for team created successfully: ${savedGroup.id}`);
      return savedGroup;
    } catch (error) {
      this.logger.error(
        `Error creating group for team: ${teamId}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Create a group linked to a project, adding all team members
  async createGroupForProject(
    projectId: string,
    projectName: string,
    createdById: number,
    teamMemberUserIds: number[],
  ) {
    this.logger.log(`Creating group for project: ${projectId}`);
    try {
      const group = this.groupRepository.create({
        name: projectName,
        type: GroupType.PROJECT,
        projectId,
        createdById,
      });
      const savedGroup = await this.groupRepository.save(group);

      // Add all team members
      for (const userId of teamMemberUserIds) {
        const role =
          userId === createdById
            ? GroupMemberRole.ADMIN
            : GroupMemberRole.MEMBER;
        const member = this.groupMemberRepository.create({
          userId,
          groupId: savedGroup.id,
          role,
        });
        await this.groupMemberRepository.save(member);
      }

      this.logger.log(
        `Group for project created successfully: ${savedGroup.id}`,
      );
      return savedGroup;
    } catch (error) {
      this.logger.error(
        `Error creating group for project: ${projectId}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Add a member to a team's group
  async addMemberByTeamId(teamId: string, userId: number) {
    this.logger.log(`Adding member ${userId} to team group: ${teamId}`);
    try {
      const group = await this.groupRepository.findOne({
        where: { teamId, type: GroupType.TEAM },
      });
      if (!group) {
        this.logger.warn(`No group found for team: ${teamId}`);
        return;
      }

      // Check if already a member
      const existing = await this.groupMemberRepository.findOne({
        where: { userId, groupId: group.id },
      });
      if (existing) return;

      const member = this.groupMemberRepository.create({
        userId,
        groupId: group.id,
        role: GroupMemberRole.MEMBER,
      });
      await this.groupMemberRepository.save(member);
      this.logger.log(`Member ${userId} added to team group successfully`);
    } catch (error) {
      this.logger.error(
        `Error adding member to team group: ${teamId}`,
        error.message,
      );
    }
  }

  // Remove a member from a team's group
  async removeMemberByTeamId(teamId: string, userId: number) {
    this.logger.log(`Removing member ${userId} from team group: ${teamId}`);
    try {
      const group = await this.groupRepository.findOne({
        where: { teamId, type: GroupType.TEAM },
      });
      if (!group) {
        this.logger.warn(`No group found for team: ${teamId}`);
        return;
      }

      const member = await this.groupMemberRepository.findOne({
        where: { userId, groupId: group.id },
      });
      if (!member) return;

      await this.groupMemberRepository.remove(member);
      this.logger.log(`Member ${userId} removed from team group successfully`);
    } catch (error) {
      this.logger.error(
        `Error removing member from team group: ${teamId}`,
        error.message,
      );
    }
  }

  // Add a member to a project's group
  async addMemberByProjectId(projectId: string, userId: number) {
    this.logger.log(`Adding member ${userId} to project group: ${projectId}`);
    try {
      const group = await this.groupRepository.findOne({
        where: { projectId, type: GroupType.PROJECT },
      });
      if (!group) {
        this.logger.warn(`No group found for project: ${projectId}`);
        return;
      }

      const existing = await this.groupMemberRepository.findOne({
        where: { userId, groupId: group.id },
      });
      if (existing) return;

      const member = this.groupMemberRepository.create({
        userId,
        groupId: group.id,
        role: GroupMemberRole.MEMBER,
      });
      await this.groupMemberRepository.save(member);
      this.logger.log(`Member ${userId} added to project group successfully`);
    } catch (error) {
      this.logger.error(
        `Error adding member to project group: ${projectId}`,
        error.message,
      );
    }
  }

  // Remove a member from a project's group
  async removeMemberByProjectId(projectId: string, userId: number) {
    this.logger.log(
      `Removing member ${userId} from project group: ${projectId}`,
    );
    try {
      const group = await this.groupRepository.findOne({
        where: { projectId, type: GroupType.PROJECT },
      });
      if (!group) {
        this.logger.warn(`No group found for project: ${projectId}`);
        return;
      }

      const member = await this.groupMemberRepository.findOne({
        where: { userId, groupId: group.id },
      });
      if (!member) return;

      await this.groupMemberRepository.remove(member);
      this.logger.log(
        `Member ${userId} removed from project group successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing member from project group: ${projectId}`,
        error.message,
      );
    }
  }

  // Check if a user is an admin of a group
  async isAdmin(groupId: string, userId: number): Promise<boolean> {
    const member = await this.groupMemberRepository.findOne({
      where: { groupId, userId },
    });
    return member?.role === GroupMemberRole.ADMIN;
  }

  private groupBelongsToBusiness(group: Group, businessId: number): boolean {
    if (!businessId) {
      return false;
    }

    if (group.type === GroupType.PROJECT) {
      return group.project?.business?.business_id === businessId;
    }

    if (group.type === GroupType.TEAM) {
      return group.team?.business?.business_id === businessId;
    }

    if (group.type === GroupType.CUSTOM) {
      return group.createdBy?.business?.business_id === businessId;
    }

    if (group.type === GroupType.DIRECT) {
      return (group.members ?? []).every(
        (member) => member.user?.business?.business_id === businessId,
      );
    }

    return false;
  }

  private async assertUsersBelongToBusiness(
    userIds: number[],
    businessId?: number,
  ) {
    if (!userIds.length || !businessId) {
      return;
    }

    const invalidUserIds: number[] = [];
    for (const userId of userIds) {
      const user = await this.collabStationHelper.findUserById(Number(userId));
      if (user?.business?.business_id !== businessId) {
        invalidUserIds.push(userId);
      }
    }

    if (invalidUserIds.length) {
      throw new HttpException(
        `Users do not belong to this business: ${invalidUserIds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
