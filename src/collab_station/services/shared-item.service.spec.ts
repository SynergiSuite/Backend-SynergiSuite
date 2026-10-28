import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientFeedback } from '../../client_feedback/entities/client-feedback.entity';
import {
  ClientFeedbackStatus,
  ClientFeedbackTargetType,
} from '../../client_feedback/enums/client_feedback.enums';
import { Milestone } from '../../milestone/entities/milestone.entity';
import { Project } from '../../projects/entities/project.entity';
import {
  Task,
  TaskPriority,
  TaskStatus,
} from '../../projects/entities/task.entity';
import { User } from '../../user/entities/user.entity';
import { ShareMessageDto } from '../dto/share-message.dto';
import { Group, GroupType } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import { SharedEntityType } from '../entities/message.entity';
import { SharedItemService } from './shared-item.service';

describe('SharedItemService', () => {
  const taskRepository = { findOne: jest.fn() };
  const milestoneRepository = { findOne: jest.fn() };
  const feedbackRepository = { findOne: jest.fn() };
  const projectRepository = { findOne: jest.fn() };
  const userRepository = { findOne: jest.fn(), find: jest.fn() };
  const groupRepository = { findOne: jest.fn() };
  const groupMemberRepository = { findOne: jest.fn() };
  let service: SharedItemService;

  const sender = {
    user_id: 1,
    email: 'founder@example.com',
    business: { business_id: 10 },
    role: { primary_role: { name: 'founder' } },
  } as User;
  const project = {
    id: '10000000-0000-4000-8000-000000000001',
    business: { business_id: 10 },
    teams: [],
    client: { email: 'client@example.com' },
  } as Project;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SharedItemService,
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        {
          provide: getRepositoryToken(Milestone),
          useValue: milestoneRepository,
        },
        {
          provide: getRepositoryToken(ClientFeedback),
          useValue: feedbackRepository,
        },
        { provide: getRepositoryToken(Project), useValue: projectRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Group), useValue: groupRepository },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: groupMemberRepository,
        },
      ],
    }).compile();
    service = module.get(SharedItemService);
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue(sender);
    projectRepository.findOne.mockResolvedValue(project);
  });

  it('builds a task card from database data', async () => {
    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      title: 'Database task',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      due_date: '2026-11-01',
      project,
    });
    const result = await service.resolveSharedEntity(
      SharedEntityType.TASK,
      'task-id',
      1,
    );
    expect(result.snapshot).toEqual({
      title: 'Database task',
      projectId: project.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: '2026-11-01',
    });
  });

  it('builds a milestone card from database data', async () => {
    milestoneRepository.findOne.mockResolvedValue({
      id: 'milestone-id',
      name: 'Launch',
      end_date: '2026-12-01',
      project,
    });
    const result = await service.resolveSharedEntity(
      SharedEntityType.MILESTONE,
      'milestone-id',
      1,
    );
    expect(result.snapshot.title).toBe('Launch');
    expect(result.snapshot.dueDate).toBe('2026-12-01');
  });

  it('resolves task-targeted client feedback to its project', async () => {
    feedbackRepository.findOne.mockResolvedValue({
      id: 'feedback-id',
      titleOfFeedback: 'Please revise',
      targetType: ClientFeedbackTargetType.TASK,
      typeId: 'target-task-id',
      status: ClientFeedbackStatus.OPEN,
      businessId: 10,
    });
    taskRepository.findOne.mockResolvedValue({ project });
    const result = await service.resolveSharedEntity(
      SharedEntityType.CLIENT_FEEDBACK,
      'feedback-id',
      1,
    );
    expect(result.projectId).toBe(project.id);
    expect(result.snapshot.targetType).toBe(ClientFeedbackTargetType.TASK);
  });

  it('rejects cross-business entities', async () => {
    taskRepository.findOne.mockResolvedValue({
      title: 'Other business',
      project: { ...project, business: { business_id: 20 } },
    });
    projectRepository.findOne.mockResolvedValue({
      ...project,
      business: { business_id: 20 },
    });
    await expect(
      service.resolveSharedEntity(SharedEntityType.TASK, 'task-id', 1),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a project group mismatch', async () => {
    groupMemberRepository.findOne.mockResolvedValue({ id: 'membership' });
    groupRepository.findOne.mockResolvedValue({
      type: GroupType.PROJECT,
      projectId: 'another-project',
      members: [],
    });
    await expect(
      service.authorizeDestination('group-id', 1, {
        projectId: project.id,
        businessId: 10,
        snapshot: { title: 'Task', projectId: project.id },
      }),
    ).rejects.toThrow('another project group');
  });

  it('rejects a sender who is not a destination member', async () => {
    groupMemberRepository.findOne.mockResolvedValue(null);
    await expect(
      service.authorizeDestination('group-id', 1, {
        projectId: project.id,
        businessId: 10,
        snapshot: { title: 'Task', projectId: project.id },
      }),
    ).rejects.toThrow('not a member');
  });

  it('rejects custom/direct recipients without project access', async () => {
    groupMemberRepository.findOne.mockResolvedValue({ id: 'membership' });
    groupRepository.findOne.mockResolvedValue({
      type: GroupType.CUSTOM,
      members: [{ userId: 1 }, { userId: 2 }],
    });
    userRepository.find.mockResolvedValue([
      {
        user_id: 2,
        email: 'outsider@example.com',
        business: { business_id: 10 },
        role: { primary_role: { name: 'employee' } },
      },
    ]);
    await expect(
      service.authorizeDestination('group-id', 1, {
        projectId: project.id,
        businessId: 10,
        snapshot: { title: 'Task', projectId: project.id },
      }),
    ).rejects.toThrow('already have access');
  });

  it('strips client-supplied snapshot fields from the validated payload', async () => {
    const dto = plainToInstance(ShareMessageDto, {
      groupId: '10000000-0000-4000-8000-000000000010',
      entityType: SharedEntityType.TASK,
      entityId: '10000000-0000-4000-8000-000000000011',
      snapshot: { title: 'Forged title' },
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect((dto as any).snapshot).toBeUndefined();
  });
});
