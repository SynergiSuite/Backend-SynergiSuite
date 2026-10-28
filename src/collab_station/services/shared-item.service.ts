import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientFeedback } from '../../client_feedback/entities/client-feedback.entity';
import { ClientFeedbackTargetType } from '../../client_feedback/enums/client_feedback.enums';
import { Milestone } from '../../milestone/entities/milestone.entity';
import { Project } from '../../projects/entities/project.entity';
import { Task } from '../../projects/entities/task.entity';
import { getAccessRoleName } from '../../roles/role-access';
import { User } from '../../user/entities/user.entity';
import { Group, GroupType } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import {
  SharedEntitySnapshot,
  SharedEntityType,
} from '../entities/message.entity';

export interface ResolvedSharedEntity {
  projectId: string;
  businessId: number;
  snapshot: SharedEntitySnapshot;
}

@Injectable()
export class SharedItemService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Milestone)
    private readonly milestoneRepository: Repository<Milestone>,
    @InjectRepository(ClientFeedback)
    private readonly feedbackRepository: Repository<ClientFeedback>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
  ) {}

  async resolveSharedEntity(
    type: SharedEntityType,
    entityId: string,
    senderId: number,
  ): Promise<ResolvedSharedEntity> {
    const sender = await this.findUser(senderId);
    let projectId: string;
    let entityBusinessId: number | undefined;
    let snapshot: SharedEntitySnapshot;

    if (type === SharedEntityType.TASK) {
      const task = await this.taskRepository.findOne({
        where: { id: entityId },
        relations: ['project', 'project.business'],
      });
      if (!task?.project) throw new NotFoundException('Task not found');
      projectId = task.project.id;
      entityBusinessId = task.project.business?.business_id;
      snapshot = {
        title: task.title,
        projectId,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
      };
    } else if (type === SharedEntityType.MILESTONE) {
      const milestone = await this.milestoneRepository.findOne({
        where: { id: entityId },
        relations: ['project', 'project.business'],
      });
      if (!milestone?.project) {
        throw new NotFoundException('Milestone not found');
      }
      projectId = milestone.project.id;
      entityBusinessId = milestone.project.business?.business_id;
      snapshot = {
        title: milestone.name,
        projectId,
        dueDate: milestone.end_date,
      };
    } else if (type === SharedEntityType.CLIENT_FEEDBACK) {
      const feedback = await this.feedbackRepository.findOne({
        where: { id: entityId },
      });
      if (!feedback) throw new NotFoundException('Client feedback not found');

      projectId = await this.resolveFeedbackProjectId(feedback);
      entityBusinessId = feedback.businessId;
      snapshot = {
        title: feedback.titleOfFeedback,
        projectId,
        status: feedback.status,
        targetType: feedback.targetType,
      };
    } else {
      throw new NotFoundException('Shared entity not found');
    }

    const project = await this.findProject(projectId);
    const projectBusinessId = project.business?.business_id;
    if (
      !projectBusinessId ||
      entityBusinessId !== projectBusinessId ||
      sender.business?.business_id !== projectBusinessId
    ) {
      throw new ForbiddenException('Cross-business sharing is not allowed');
    }

    if (!this.canUserViewProject(sender, project)) {
      throw new ForbiddenException('You cannot access the source project');
    }

    return {
      projectId,
      businessId: projectBusinessId,
      snapshot,
    };
  }

  async authorizeDestination(
    groupId: string,
    senderId: number,
    resolved: ResolvedSharedEntity,
  ): Promise<void> {
    const membership = await this.groupMemberRepository.findOne({
      where: { groupId, userId: senderId },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException('Group not found');

    if (group.type === GroupType.PROJECT) {
      if (group.projectId !== resolved.projectId) {
        throw new ForbiddenException(
          'Items cannot be shared into another project group',
        );
      }
    }

    const project = await this.findProject(resolved.projectId);
    const recipientIds = (group.members ?? [])
      .map((member) => member.userId)
      .filter((userId) => userId !== senderId);
    if (!recipientIds.length) return;

    const recipients = await this.userRepository.find({
      where: recipientIds.map((user_id) => ({ user_id })),
      relations: ['business', 'role', 'role.primary_role'],
    });
    if (
      recipients.length !== recipientIds.length ||
      recipients.some(
        (recipient) => !this.canUserViewProject(recipient, project),
      )
    ) {
      throw new ForbiddenException(
        'Every group recipient must already have access to the source project',
      );
    }
  }

  private async resolveFeedbackProjectId(
    feedback: ClientFeedback,
  ): Promise<string> {
    if (feedback.targetType === ClientFeedbackTargetType.PROJECT) {
      return feedback.typeId;
    }
    if (feedback.targetType === ClientFeedbackTargetType.MILESTONE) {
      const milestone = await this.milestoneRepository.findOne({
        where: { id: feedback.typeId },
        relations: ['project'],
      });
      if (!milestone?.project) {
        throw new NotFoundException('Feedback target milestone not found');
      }
      return milestone.project.id;
    }
    if (feedback.targetType === ClientFeedbackTargetType.TASK) {
      const task = await this.taskRepository.findOne({
        where: { id: feedback.typeId },
        relations: ['project'],
      });
      if (!task?.project) {
        throw new NotFoundException('Feedback target task not found');
      }
      return task.project.id;
    }
    throw new NotFoundException('Feedback target not found');
  }

  private findProject(projectId: string): Promise<Project> {
    return this.projectRepository
      .findOne({
        where: { id: projectId },
        relations: [
          'business',
          'client',
          'teams',
          'teams.leader',
          'teams.members',
          'teams.members.user',
        ],
      })
      .then((project) => {
        if (!project) throw new NotFoundException('Project not found');
        return project;
      });
  }

  private findUser(userId: number): Promise<User> {
    return this.userRepository
      .findOne({
        where: { user_id: userId },
        relations: ['business', 'role', 'role.primary_role'],
      })
      .then((user) => {
        if (!user) throw new NotFoundException('User not found');
        return user;
      });
  }

  private canUserViewProject(user: User, project: Project): boolean {
    if (
      !user.business?.business_id ||
      user.business.business_id !== project.business?.business_id
    ) {
      return false;
    }

    const role = getAccessRoleName(user.role);
    if (role === 'founder' || role === 'manager') return true;
    if (role === 'client') return user.email === project.client?.email;

    return (project.teams ?? []).some(
      (team) =>
        team.leader?.user_id === user.user_id ||
        (team.members ?? []).some(
          (membership) => membership.user?.user_id === user.user_id,
        ),
    );
  }
}
