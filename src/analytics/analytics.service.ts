import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import {
  ActivityAction,
  ActivityLog,
} from '../activity/entities/activity-log.entity';
import { Business } from '../business/entities/business.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientFeedbackReply } from '../client_feedback/entities/client-feedback-reply.entity';
import {
  ClientFeedback,
  ClientFeedbackStatus,
  ClientFeedbackTargetType,
} from '../client_feedback/entities/client-feedback.entity';
import { Call, CallStatus } from '../collab_station/entities/call.entity';
import {
  Meeting,
  MeetingStatus,
} from '../collab_station/entities/meeting.entity';
import { Message } from '../collab_station/entities/message.entity';
import { Project } from '../projects/entities/project.entity';
import {
  Task,
  TaskPriority,
  TaskStatus,
} from '../projects/entities/task.entity';
import { Team } from '../teams/entities/team.entity';
import { User } from '../user/entities/user.entity';
import { toRoleResponse } from '../roles/role-access';
import { AnalyticsDateRange, AnalyticsHelper } from './analytics.helper';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsMetricType,
  AnalyticsRecord,
} from './entities/analytics-record.entity';

type DateRange = AnalyticsDateRange;

@Injectable()
export class AnalyticsService {
  private readonly statusTransitionWeights: Record<string, number> = {
    [`${TaskStatus.TODO}->${TaskStatus.IN_PROGRESS}`]: 1,
    [`${TaskStatus.IN_PROGRESS}->${TaskStatus.REVIEW}`]: 2,
    [`${TaskStatus.REVIEW}->${TaskStatus.COMPLETED}`]: 3,
    [`${TaskStatus.TODO}->${TaskStatus.REVIEW}`]: 3,
    [`${TaskStatus.IN_PROGRESS}->${TaskStatus.COMPLETED}`]: 5,
    [`${TaskStatus.TODO}->${TaskStatus.COMPLETED}`]: 6,
    [`${TaskStatus.REVIEW}->${TaskStatus.IN_PROGRESS}`]: -1,
    [`${TaskStatus.COMPLETED}->${TaskStatus.REVIEW}`]: -2,
    [`${TaskStatus.COMPLETED}->${TaskStatus.IN_PROGRESS}`]: -3,
    [`${TaskStatus.COMPLETED}->${TaskStatus.TODO}`]: -4,
  };

  private readonly taskUpdateWeights: Record<string, number> = {
    priority: 0.5,
    due_date: 0.5,
    description: 0.25,
    title: 0.25,
  };

  private readonly priorityWeights: Record<string, number> = {
    [TaskPriority.LOW]: 1,
    [TaskPriority.MEDIUM]: 2,
    [TaskPriority.HIGH]: 3,
  };

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepository: Repository<ActivityLog>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientFeedback)
    private readonly clientFeedbackRepository: Repository<ClientFeedback>,
    @InjectRepository(ClientFeedbackReply)
    private readonly clientFeedbackReplyRepository: Repository<ClientFeedbackReply>,
    @InjectRepository(Call)
    private readonly callRepository: Repository<Call>,
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly analyticsHelper: AnalyticsHelper,
  ) {}

  async getEmployeeProductivity(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);
    const where: FindOptionsWhere<ActivityLog> = {
      businessId,
      module: 'tasks',
      action: ActivityAction.UPDATED,
      createdAt: Between(range.startDate, range.endDate),
    };

    if (query.userId) {
      where.userId = query.userId;
    }

    const activities = await this.activityRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const employees = new Map<number, any>();
    for (const activity of activities) {
      if (!activity.userId) continue;

      const employee = employees.get(activity.userId) ?? {
        userId: activity.userId,
        userName: activity.userName,
        userEmail: activity.userEmail,
        productivityIndex: 0,
        statusMovementScore: 0,
        taskUpdateScore: 0,
        statusChanges: 0,
        taskUpdates: 0,
        activities: [],
      };

      let score = 0;
      if (activity.fieldChanged === 'status') {
        const key = `${activity.oldValue}->${activity.newValue}`;
        score = this.statusTransitionWeights[key] ?? 0;
        employee.statusMovementScore += score;
        employee.statusChanges += 1;
      } else if (activity.fieldChanged) {
        score = this.taskUpdateWeights[activity.fieldChanged] ?? 0;
        employee.taskUpdateScore += score;
        employee.taskUpdates += 1;
      }

      employee.productivityIndex += score;
      employee.activities.push({
        activityId: activity.id,
        taskId: activity.entityId,
        taskName: activity.entityName,
        fieldChanged: activity.fieldChanged,
        oldValue: activity.oldValue,
        newValue: activity.newValue,
        score,
        createdAt: activity.createdAt,
      });
      employees.set(activity.userId, employee);
    }

    return {
      range,
      weights: {
        statusTransitionWeights: this.statusTransitionWeights,
        taskUpdateWeights: this.taskUpdateWeights,
      },
      employees: Array.from(employees.values()).sort(
        (first, second) => second.productivityIndex - first.productivityIndex,
      ),
    };
  }

  async getEmployeesAnalytics(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);

    const userWhere: FindOptionsWhere<User> = {
      business: { business_id: businessId },
    };

    if (query.userId) userWhere.user_id = query.userId;

    // 1. Fetch only the base user + role. (Massive performance boost here)
    const users = await this.userRepository.find({
      where: userWhere,
      relations: ['role', 'role.primary_role'],
      order: { name: 'ASC' },
    });
    const employeesOnly = users.filter((user) => !this.isClientUser(user));

    if (query.userId && employeesOnly.length === 0) {
      throw new BadRequestException(
        'Employee does not exist for this business.',
      );
    }

    // 2. The child method will now fetch its own isolated data concurrently
    const employees = await Promise.all(
      employeesOnly.map((user) =>
        this.calculateEmployeeAnalyticsForUser(user, businessId, range),
      ),
    );

    return {
      range,
      summary: this.buildEmployeesAnalyticsSummary(employees),
      employees: employees.sort(
        (first, second) =>
          second.analytics.productivityIndex -
          first.analytics.productivityIndex,
      ),
      weights: {
        statusTransitionWeights: this.statusTransitionWeights,
        taskUpdateWeights: this.taskUpdateWeights,
        priorityWeights: this.priorityWeights,
      },
    };
  }

  async getEmployeeDetail(
    reqUser: any,
    userId: number,
    query: AnalyticsQueryDto,
  ) {
    const { businessId } = await this.getBusinessContext(reqUser);
    return this.getEmployeeDetailByBusinessId(businessId, userId, query);
  }

  async getEmployeeDetailByBusinessId(
    businessId: number,
    userId: number,
    query: AnalyticsQueryDto,
  ): Promise<any> {
    const range = this.resolveDateRange(query);
    const user = await this.getBusinessEmployeeOrFail(userId, businessId);
    const employee = await this.calculateEmployeeAnalyticsForUser(
      user,
      businessId,
      range,
    );

    if (!employee) {
      throw new NotFoundException('Employee not found for this business.');
    }

    return {
      range,
      employee,
    };
  }

  async getTeamsAnalytics(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const teamWhere: FindOptionsWhere<Team> = {
      business: { business_id: businessId },
    };

    if (query.teamId) {
      teamWhere.id = query.teamId;
    }

    const teams = await this.teamRepository.find({
      where: teamWhere,
      relationLoadStrategy: 'query',
      relations: ['leader', 'members', 'members.user', 'projects', 'tasks'],
      order: { name: 'ASC' },
    });

    if (query.teamId && teams.length === 0) {
      throw new BadRequestException('Team does not exist for this business.');
    }

    return {
      teams: teams.map((team) => this.toTeamSummary(team)),
      summary: {
        totalTeams: teams.length,
        totalMembers: teams.reduce(
          (sum, team) => sum + (team.members?.length ?? 0),
          0,
        ),
        totalProjects: teams.reduce(
          (sum, team) => sum + (team.projects?.length ?? 0),
          0,
        ),
        totalTasks: teams.reduce(
          (sum, team) => sum + (team.tasks?.length ?? 0),
          0,
        ),
      },
    };
  }

  async getUserTasksDetail(
    reqUser: any,
    userId: number,
    query: AnalyticsQueryDto,
  ) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);
    const user = await this.getBusinessEmployeeOrFail(userId, businessId);
    const teams = await this.teamRepository.find({
      where: [
        {
          business: { business_id: businessId },
          members: { user: { user_id: userId } },
        },
        {
          business: { business_id: businessId },
          leader: { user_id: userId },
        },
      ],
      relations: ['leader'],
    });
    const teamIds = teams.map((team) => team.id);
    const [projects, taskRows] = teamIds.length
      ? await Promise.all([
          this.projectRepository.find({
            where: {
              business: { business_id: businessId },
              teams: { id: In(teamIds) },
            },
            relations: ['client', 'teams'],
            order: { name: 'ASC' },
          }),
          this.taskRepository.find({
            where: [
              {
                project: { business: { business_id: businessId } },
                teams: { id: In(teamIds) },
              },
              {
                project: {
                  business: { business_id: businessId },
                  teams: { id: In(teamIds) },
                },
              },
            ],
            relations: ['project', 'project.client', 'teams', 'milestone'],
            order: { updated_at: 'DESC' },
          }),
        ])
      : [[], []];
    const tasks = Array.from(
      new Map(taskRows.map((task) => [task.id, task])).values(),
    );

    return {
      range,
      employee: this.toEmployeeBrief(user),
      summary: this.buildTaskSummary(tasks),
      teams: teams.map((team) => ({
        teamId: team.id,
        teamName: team.name,
        leader: team.leader
          ? {
              userId: team.leader.user_id,
              name: team.leader.name,
              email: team.leader.email,
            }
          : null,
      })),
      projects: projects.map((project) => this.toProjectSummary(project)),
      tasks: tasks.map((task) => ({
        ...this.toTaskSummary(task),
        milestone: task.milestone
          ? {
              milestoneId: task.milestone.id,
              name: task.milestone.name,
            }
          : null,
      })),
    };
  }

  async getUserScheduledMeetings(
    reqUser: any,
    userId: number,
    query: AnalyticsQueryDto,
  ) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);
    const user = await this.getBusinessEmployeeOrFail(userId, businessId);
    const meetings = await this.meetingRepository
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.group', 'meetingGroup')
      .leftJoinAndSelect('meeting.host', 'host')
      .leftJoinAndSelect('meeting.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'participantUser')
      .where('meeting.status = :status', { status: MeetingStatus.SCHEDULED })
      .andWhere(
        '(meeting."hostId" = :userId OR participant."userId" = :userId)',
        {
          userId,
        },
      )
      .andWhere('host.business_id = :businessId', { businessId })
      .andWhere(
        'COALESCE(meeting."startsAt", meeting."createdAt") BETWEEN :startDate AND :endDate',
        {
          startDate: range.startDate,
          endDate: range.endDate,
        },
      )
      .orderBy('COALESCE(meeting."startsAt", meeting."createdAt")', 'ASC')
      .getMany();
    const uniqueMeetings = Array.from(
      new Map(meetings.map((meeting) => [meeting.id, meeting])).values(),
    );

    return {
      range,
      employee: this.toEmployeeBrief(user),
      summary: {
        totalScheduledMeetings: uniqueMeetings.length,
        hostedMeetings: uniqueMeetings.filter(
          (meeting) => meeting.hostId === userId,
        ).length,
        invitedMeetings: uniqueMeetings.filter((meeting) =>
          (meeting.participants ?? []).some(
            (participant) => participant.userId === userId,
          ),
        ).length,
      },
      meetings: uniqueMeetings.map((meeting) => ({
        meetingId: meeting.id,
        groupId: meeting.groupId,
        groupName: meeting.group?.name ?? null,
        title: meeting.title,
        roomName: meeting.livekitRoomName,
        status: meeting.status,
        startsAt: meeting.startsAt,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
        createdAt: meeting.createdAt,
        host: meeting.host
          ? {
              userId: meeting.host.user_id,
              name: meeting.host.name,
              email: meeting.host.email,
            }
          : null,
        participants: (meeting.participants ?? []).map((participant) => ({
          userId: participant.userId,
          name: participant.user?.name ?? null,
          email: participant.user?.email ?? null,
          role: participant.role,
          invitedAt: participant.invitedAt,
          joinedAt: participant.joinedAt,
          leftAt: participant.leftAt,
        })),
      })),
    };
  }

  async getBusinessDetail(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);

    // 1. Run all independent queries CONCURRENTLY
    const [
      business,
      users,
      clients,
      projects,
      teams,
      recentActivities,
      overview,
    ] = await Promise.all([
      // Fetch Business + Category ONLY
      this.businessRepository.findOne({
        where: { business_id: businessId },
        relations: ['category'],
      }),

      // Fetch related domains in separate queries to avoid Cartesian explosion
      this.userRepository.find({
        // assuming you can inject userRepository
        where: { business: { business_id: businessId } },
        relations: ['role', 'role.primary_role'],
      }),

      this.clientRepository.find({
        where: { business: { business_id: businessId } },
      }),

      this.projectRepository.find({
        where: { business: { business_id: businessId } },
        relations: ['client', 'teams', 'tasks'],
      }),

      this.teamRepository.find({
        where: { business: { business_id: businessId } },
        relations: ['leader', 'members', 'members.user'],
      }),

      // Fetch Activities
      this.activityRepository.find({
        where: {
          businessId,
          createdAt: Between(range.startDate, range.endDate),
        },
        order: { createdAt: 'DESC' },
        take: 50,
      }),

      // Fetch Overview
      this.getOverview(reqUser, query),
    ]);

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    const employeesOnly = users.filter((user) => !this.isClientUser(user));

    // Calculate Tasks from the fetched projects
    const tasks = projects.flatMap((project) => project.tasks ?? []);
    const completedTasks = tasks.filter(
      (task) => task.status === TaskStatus.COMPLETED,
    ).length;

    return {
      range,
      business: {
        businessId: business.business_id,
        name: business.name,
        numberOfEmployees: business.number_of_employees,
        registrationDate: business.registration_date,
        category: business.category
          ? {
              id: business.category.id,
              name: business.category.name,
            }
          : null,
      },
      counts: {
        users: employeesOnly.length,
        clients: clients.length,
        projects: projects.length,
        teams: teams.length,
        tasks: tasks.length,
        completedTasks,
      },
      employees: employeesOnly.map((user) => ({
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: toRoleResponse(user.role),
        isVerified: user.is_Verified,
        registrationDate: user.registration_date,
      })),
      clients: clients.map((client) => this.toClientSummary(client)),
      projects: projects.map((project) => this.toProjectSummary(project)),
      teams: teams.map((team) => this.toTeamSummary(team)),
      overview: overview.kpiOverview,
      recentActivities: recentActivities.map((activity) =>
        this.toActivityResponse(activity),
      ),
    };
  }

  async getClientDetail(
    reqUser: any,
    clientId: string,
    query: AnalyticsQueryDto,
  ) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const client = await this.clientRepository.findOne({
      where: {
        id: clientId,
        business: { business_id: businessId },
      },
      relations: ['business', 'projects', 'projects.tasks', 'projects.teams'],
    });

    if (!client) {
      throw new NotFoundException('Client not found for this business.');
    }

    const analytics = await this.getClientAnalytics(reqUser, {
      ...query,
      clientId,
    });
    const feedback = await this.clientFeedbackRepository.find({
      where: { businessId, clientId },
      relations: ['createdBy', 'replies', 'replies.createdBy'],
      order: { createdAt: 'DESC' },
    });

    return {
      client: this.toClientSummary(client),
      projects: (client.projects ?? []).map((project) =>
        this.toProjectSummary(project),
      ),
      analytics: analytics.data.clients[0] ?? null,
      feedback: feedback.map((item) => ({
        id: item.id,
        titleOfFeedback: item.titleOfFeedback,
        feedback: item.feedback,
        feedbackType: item.feedbackType,
        status: item.status,
        starRating: item.starRating,
        targetType: item.targetType,
        typeId: item.typeId,
        createdAt: item.createdAt,
        createdBy: item.createdBy
          ? {
              userId: item.createdBy.user_id,
              name: item.createdBy.name,
              email: item.createdBy.email,
            }
          : null,
        replies: (item.replies ?? [])
          .sort(
            (first, second) =>
              first.createdAt.getTime() - second.createdAt.getTime(),
          )
          .map((reply) => ({
            id: reply.id,
            message: reply.message,
            createdAt: reply.createdAt,
            replier: reply.createdBy
              ? {
                  userId: reply.createdBy.user_id,
                  name: reply.createdBy.name,
                  email: reply.createdBy.email,
                }
              : null,
          })),
      })),
    };
  }

  async getProjectDetail(
    reqUser: any,
    projectId: string,
    query: AnalyticsQueryDto,
  ) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);
    const project = await this.projectRepository.findOne({
      where: {
        id: projectId,
        business: { business_id: businessId },
      },
      relations: [
        'business',
        'client',
        'teams',
        'teams.leader',
        'teams.members',
        'teams.members.user',
        'tasks',
        'tasks.teams',
        'milestones',
      ],
    });

    if (!project) {
      throw new NotFoundException('Project not found for this business.');
    }

    const taskIds = (project.tasks ?? []).map((task) => task.id);
    const activities = await this.activityRepository.find({
      where: [
        {
          businessId,
          module: 'projects',
          entityId: project.id,
          createdAt: Between(range.startDate, range.endDate),
        },
        ...(taskIds.length
          ? [
              {
                businessId,
                module: 'tasks',
                entityId: In(taskIds),
                createdAt: Between(range.startDate, range.endDate),
              },
            ]
          : []),
      ],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const feedback = await this.clientFeedbackRepository.find({
      where: {
        businessId,
        targetType: ClientFeedbackTargetType.PROJECT,
        typeId: project.id,
      },
      relations: ['client', 'replies'],
      order: { createdAt: 'DESC' },
    });

    return {
      range,
      project: this.toProjectSummary(project),
      client: project.client ? this.toClientSummary(project.client) : null,
      teams: (project.teams ?? []).map((team) => this.toTeamSummary(team)),
      milestones: (project.milestones ?? []).map((milestone) => ({
        milestoneId: milestone.id,
        name: milestone.name,
        endDate: milestone.end_date,
        createdAt: milestone.created_at,
        updatedAt: milestone.updated_at,
      })),
      tasks: (project.tasks ?? []).map((task) => this.toTaskSummary(task)),
      taskSummary: this.buildTaskSummary(project.tasks ?? []),
      feedbackSummary: {
        totalFeedback: feedback.length,
        resolvedFeedback: feedback.filter(
          (item) => item.status === ClientFeedbackStatus.RESOLVED,
        ).length,
        totalReplies: feedback.reduce(
          (sum, item) => sum + (item.replies?.length ?? 0),
          0,
        ),
      },
      feedback,
      activities: activities.map((activity) =>
        this.toActivityResponse(activity),
      ),
    };
  }

  async getTeamDetail(reqUser: any, teamId: string, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    return this.getTeamDetailByBusinessId(businessId, teamId, query);
  }

  async getTeamDetailByBusinessId(
    businessId: number,
    teamId: string,
    query: AnalyticsQueryDto,
  ): Promise<any> {
    const range = this.resolveDateRange(query);

    // 1. Fetch team using 'query' strategy to prevent Cartesian explosion on tasks/projects
    const team = await this.teamRepository.findOne({
      where: {
        id: teamId,
        business: { business_id: businessId },
      },
      relationLoadStrategy: 'query',
      relations: [
        'leader',
        'members',
        'members.user',
        'members.user.role',
        'members.user.role.primary_role',
        'projects',
        'tasks',
        'tasks.project',
      ],
    });

    if (!team) {
      throw new NotFoundException('Team not found for this business.');
    }

    // 2. Extract the base user entities directly from the team relation
    // We completely bypass the need for a second heavy userRepository query!
    const memberUsers = (team.members ?? [])
      .map((member) => member.user)
      .filter((user) => user && !this.isClientUser(user));

    const memberIds = memberUsers.map((user) => user.user_id);

    // 3. Fetch activities and process analytics concurrently
    const [memberActivities, memberAnalytics] = await Promise.all([
      memberIds.length
        ? this.activityRepository.find({
            where: {
              businessId,
              userId: In(memberIds),
              createdAt: Between(range.startDate, range.endDate),
            },
            order: { createdAt: 'DESC' },
            take: 100,
          })
        : Promise.resolve([]),

      // Pass the base user objects into our updated, highly-efficient calculator
      Promise.all(
        memberUsers.map((user) =>
          this.calculateEmployeeAnalyticsForUser(user, businessId, range),
        ),
      ),
    ]);

    const memberActivityResponses = memberActivities.map((activity) =>
      this.toActivityResponse(activity),
    );

    const enrichedMembers = memberAnalytics.map((member) => ({
      ...member,
      activity: member.analytics,
      taskSummary: member.taskAnalytics,
      deadlineSummary: member.deadlineAnalytics,
      meetingSummary: member.meetingAnalytics,
      collaborationSummary: member.collaborationAnalytics,
      activities: member.recentActivities,
    }));

    return {
      range,
      team: this.toTeamSummary(team),
      leader: team.leader
        ? {
            userId: team.leader.user_id,
            name: team.leader.name,
            email: team.leader.email,
          }
        : null,
      members: enrichedMembers,
      memberActivitySummary: {
        totalMembers: enrichedMembers.length,
        totalActivities: enrichedMembers.reduce(
          (sum, member) => sum + member.analytics.totalActivities,
          0,
        ),
        totalStatusChanges: enrichedMembers.reduce(
          (sum, member) => sum + member.analytics.statusChanges,
          0,
        ),
        totalTaskUpdates: enrichedMembers.reduce(
          (sum, member) => sum + member.analytics.taskUpdates,
          0,
        ),
        totalProductivityIndex: enrichedMembers.reduce(
          (sum, member) => sum + member.analytics.productivityIndex,
          0,
        ),
        topMember:
          [...enrichedMembers].sort(
            (first, second) =>
              second.analytics.productivityIndex -
              first.analytics.productivityIndex,
          )[0] ?? null,
      },
      memberActivities: memberActivityResponses,
      projects: (team.projects ?? []).map((project) =>
        this.toProjectSummary(project),
      ),
      tasks: (team.tasks ?? []).map((task) => this.toTaskSummary(task)),
      taskSummary: this.buildTaskSummary(team.tasks ?? []),
      activities: memberActivityResponses, // Note: You returned this twice in the original, you might want to remove one
    };
  }

  async getTeamExecutionVelocity(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);
    const days = Math.max(
      1,
      Math.ceil(
        (range.endDate.getTime() - range.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    const teamWhere: FindOptionsWhere<Team> = {
      business: { business_id: businessId },
    };
    if (query.teamId) {
      teamWhere.id = query.teamId;
    }

    const teams = await this.teamRepository.find({
      where: teamWhere,
      relations: ['tasks'],
    });

    const result = teams.map((team) => {
      const tasks = team.tasks ?? [];
      const completedTasks = tasks.filter(
        (task) =>
          task.status === TaskStatus.COMPLETED &&
          task.updated_at >= range.startDate &&
          task.updated_at <= range.endDate,
      );
      const weightedCompletedScore = completedTasks.reduce(
        (score, task) => score + this.getPriorityWeight(task.priority),
        0,
      );

      return {
        teamId: team.id,
        teamName: team.name,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        weightedCompletedScore,
        periodDays: days,
        executionVelocity: Number((weightedCompletedScore / days).toFixed(2)),
      };
    });

    return {
      range,
      weights: { priorityWeights: this.priorityWeights },
      teams: result.sort(
        (first, second) => second.executionVelocity - first.executionVelocity,
      ),
    };
  }

  async getQuarterlyGrowth(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const currentRange = this.resolveQuarterRange(query);
    const previousRange = this.getPreviousRange(currentRange);

    const current = await this.getGrowthScore(businessId, currentRange);
    const previous = await this.getGrowthScore(businessId, previousRange);
    const growthChangePercent =
      previous.score > 0
        ? Number(
            (((current.score - previous.score) / previous.score) * 100).toFixed(
              2,
            ),
          )
        : current.score > 0
          ? 100
          : 0;

    return {
      currentRange,
      previousRange,
      current,
      previous,
      quarterlyGrowthIndex: current.score,
      growthChangePercent,
      weights: {
        newProject: 3,
        newClient: 2,
        newEmployee: 2,
        completedTask: 1,
      },
    };
  }

  async getClientAnalytics(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const range = this.resolveDateRange(query);
    const cachedRecord = await this.findFreshClientAnalyticsRecord(
      businessId,
      query,
      range,
    );

    if (cachedRecord) {
      return {
        source: 'cache',
        calculatedAt: cachedRecord.calculatedAt,
        recordId: cachedRecord.id,
        data: cachedRecord.data,
      };
    }

    const clientWhere: FindOptionsWhere<Client> = {
      business: { business_id: businessId },
    };

    if (query.clientId) {
      clientWhere.id = query.clientId;
    }

    const clients = await this.clientRepository.find({
      where: clientWhere,
      relations: ['business'],
      order: { created_at: 'DESC' },
    });

    if (query.clientId && clients.length === 0) {
      throw new BadRequestException('Client does not exist for this business.');
    }

    const clientAnalytics = await Promise.all(
      clients.map((client) =>
        this.calculateClientAnalyticsForClient(client, businessId, range),
      ),
    );

    const data = {
      range,
      clients: clientAnalytics.sort(
        (first, second) => second.healthScore - first.healthScore,
      ),
      summary: this.buildClientAnalyticsSummary(clientAnalytics),
      weights: {
        taskCompletionRate: 0.4,
        averageRatingPercent: 0.3,
        resolvedFeedbackRate: 0.2,
        responseRate: 0.1,
      },
    };

    const averageHealthScore =
      clientAnalytics.length > 0
        ? Number(
            (
              clientAnalytics.reduce(
                (sum, client) => sum + client.healthScore,
                0,
              ) / clientAnalytics.length
            ).toFixed(2),
          )
        : 0;

    const record = await this.saveRecord({
      businessId,
      metricType: AnalyticsMetricType.CLIENT_ANALYTICS,
      scopeType: query.clientId ? 'client' : 'business',
      scopeId: query.clientId ?? String(businessId),
      scopeName: query.clientId ? clientAnalytics[0]?.clientName : null,
      periodStart: range.startDate,
      periodEnd: range.endDate,
      score: averageHealthScore,
      data,
      calculatedAt: new Date(),
    });

    return {
      source: 'calculated',
      calculatedAt: record.calculatedAt,
      recordId: record.id,
      data,
    };
  }

  async getOverview(reqUser: any, query: AnalyticsQueryDto) {
    const [employeeProductivity, teamExecutionVelocity, quarterlyGrowth] =
      await Promise.all([
        this.getEmployeeProductivity(reqUser, query),
        this.getTeamExecutionVelocity(reqUser, query),
        this.getQuarterlyGrowth(reqUser, query),
      ]);
    const employees = employeeProductivity.employees;
    const teams = teamExecutionVelocity.teams;
    const totalProductivity = employees.reduce(
      (sum, employee) => sum + employee.productivityIndex,
      0,
    );
    const totalVelocity = teams.reduce(
      (sum, team) => sum + team.executionVelocity,
      0,
    );

    return {
      kpiOverview: {
        employeeProductivity: {
          totalEmployees: employees.length,
          averageProductivityIndex:
            employees.length > 0
              ? Number((totalProductivity / employees.length).toFixed(2))
              : 0,
          topEmployee: employees[0] ?? null,
        },
        teamExecutionVelocity: {
          totalTeams: teams.length,
          averageExecutionVelocity:
            teams.length > 0
              ? Number((totalVelocity / teams.length).toFixed(2))
              : 0,
          topTeam: teams[0] ?? null,
        },
        quarterlyGrowth: {
          quarterlyGrowthIndex: quarterlyGrowth.quarterlyGrowthIndex,
          growthChangePercent: quarterlyGrowth.growthChangePercent,
          currentScore: quarterlyGrowth.current.score,
          previousScore: quarterlyGrowth.previous.score,
        },
      },
      employeeProductivity,
      teamExecutionVelocity,
      quarterlyGrowth,
    };
  }

  async getIndexes(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const cachedRecord = await this.findFreshOverviewRecord(businessId, query);

    if (cachedRecord) {
      return {
        source: 'cache',
        calculatedAt: cachedRecord.calculatedAt,
        recordId: cachedRecord.id,
        data: cachedRecord.data,
      };
    }

    const data = await this.getOverview(reqUser, query);
    const range = this.resolveDateRange(query);
    const record = await this.saveRecord({
      businessId,
      metricType: AnalyticsMetricType.OVERVIEW,
      scopeType: 'business',
      scopeId: String(businessId),
      scopeName: null,
      periodStart: range.startDate,
      periodEnd: range.endDate,
      score: data.quarterlyGrowth.quarterlyGrowthIndex,
      data,
      calculatedAt: new Date(),
    });

    return {
      source: 'calculated',
      calculatedAt: record.calculatedAt,
      recordId: record.id,
      data,
    };
  }

  async calculateAndStore(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    const calculatedAt = new Date();
    const records: AnalyticsRecord[] = [];

    if (
      !query.metricType ||
      query.metricType === AnalyticsMetricType.EMPLOYEE_PRODUCTIVITY
    ) {
      const employeeProductivity = await this.getEmployeeProductivity(
        reqUser,
        query,
      );
      const employees = employeeProductivity.employees.length
        ? employeeProductivity.employees
        : [
            {
              userId: query.userId ?? null,
              userName: null,
              userEmail: null,
              productivityIndex: 0,
            },
          ];

      for (const employee of employees) {
        records.push(
          await this.saveRecord({
            businessId,
            metricType: AnalyticsMetricType.EMPLOYEE_PRODUCTIVITY,
            scopeType: employee.userId ? 'user' : null,
            scopeId: employee.userId ? String(employee.userId) : null,
            scopeName: employee.userName,
            periodStart: employeeProductivity.range.startDate,
            periodEnd: employeeProductivity.range.endDate,
            score: employee.productivityIndex,
            data: employee,
            calculatedAt,
          }),
        );
      }
    }

    if (
      !query.metricType ||
      query.metricType === AnalyticsMetricType.TEAM_EXECUTION_VELOCITY
    ) {
      const teamExecutionVelocity = await this.getTeamExecutionVelocity(
        reqUser,
        query,
      );
      const teams = teamExecutionVelocity.teams.length
        ? teamExecutionVelocity.teams
        : [
            {
              teamId: query.teamId ?? null,
              teamName: null,
              executionVelocity: 0,
            },
          ];

      for (const team of teams) {
        records.push(
          await this.saveRecord({
            businessId,
            metricType: AnalyticsMetricType.TEAM_EXECUTION_VELOCITY,
            scopeType: team.teamId ? 'team' : null,
            scopeId: team.teamId,
            scopeName: team.teamName,
            periodStart: teamExecutionVelocity.range.startDate,
            periodEnd: teamExecutionVelocity.range.endDate,
            score: team.executionVelocity,
            data: team,
            calculatedAt,
          }),
        );
      }
    }

    if (
      !query.metricType ||
      query.metricType === AnalyticsMetricType.QUARTERLY_GROWTH
    ) {
      const quarterlyGrowth = await this.getQuarterlyGrowth(reqUser, query);
      records.push(
        await this.saveRecord({
          businessId,
          metricType: AnalyticsMetricType.QUARTERLY_GROWTH,
          scopeType: 'business',
          scopeId: String(businessId),
          scopeName: null,
          periodStart: quarterlyGrowth.currentRange.startDate,
          periodEnd: quarterlyGrowth.currentRange.endDate,
          score: quarterlyGrowth.quarterlyGrowthIndex,
          data: quarterlyGrowth,
          calculatedAt,
        }),
      );
    }

    if (
      !query.metricType ||
      query.metricType === AnalyticsMetricType.CLIENT_ANALYTICS
    ) {
      const clientAnalytics = await this.getClientAnalytics(reqUser, query);
      const clients = clientAnalytics.data.clients.length
        ? clientAnalytics.data.clients
        : [
            {
              clientId: query.clientId ?? null,
              clientName: null,
              healthScore: 0,
            },
          ];

      for (const client of clients) {
        records.push(
          await this.saveRecord({
            businessId,
            metricType: AnalyticsMetricType.CLIENT_ANALYTICS,
            scopeType: client.clientId ? 'client' : null,
            scopeId: client.clientId,
            scopeName: client.clientName,
            periodStart: clientAnalytics.data.range.startDate,
            periodEnd: clientAnalytics.data.range.endDate,
            score: client.healthScore,
            data: client,
            calculatedAt,
          }),
        );
      }
    }

    if (query.metricType === AnalyticsMetricType.OVERVIEW) {
      const overview = await this.getOverview(reqUser, query);
      const range = this.resolveDateRange(query);
      records.push(
        await this.saveRecord({
          businessId,
          metricType: AnalyticsMetricType.OVERVIEW,
          scopeType: 'business',
          scopeId: String(businessId),
          scopeName: null,
          periodStart: range.startDate,
          periodEnd: range.endDate,
          score: overview.quarterlyGrowth.quarterlyGrowthIndex,
          data: overview,
          calculatedAt,
        }),
      );
    }

    return {
      message: 'Analytics calculated and stored successfully.',
      count: records.length,
      records,
    };
  }

  async getRecords(reqUser: any, query: AnalyticsQueryDto) {
    const { businessId } = await this.getBusinessContext(reqUser);
    return this.analyticsHelper.findRecordsForBusiness(businessId, query);
  }

  private async getGrowthScore(businessId: number, range: DateRange) {
    const [newProjects, newClients, newEmployees, completedActivities] =
      await Promise.all([
        this.projectRepository.count({
          where: {
            business: { business_id: businessId },
            created_at: Between(range.startDate, range.endDate),
          },
        }),
        this.clientRepository.count({
          where: {
            business: { business_id: businessId },
            created_at: Between(range.startDate, range.endDate),
          },
        }),
        this.userRepository.count({
          where: {
            business: { business_id: businessId },
            registration_date: Between(range.startDate, range.endDate),
          },
        }),
        this.activityRepository.count({
          where: {
            businessId,
            module: 'tasks',
            action: ActivityAction.UPDATED,
            fieldChanged: 'status',
            newValue: TaskStatus.COMPLETED,
            createdAt: Between(range.startDate, range.endDate),
          },
        }),
      ]);

    const score =
      newProjects * 3 + newClients * 2 + newEmployees * 2 + completedActivities;

    return {
      newProjects,
      newClients,
      newEmployees,
      completedTasks: completedActivities,
      score,
    };
  }

  private async calculateEmployeeAnalyticsForUser(
    user: User,
    businessId: number,
    range: DateRange,
  ) {
    // 1. Fetch user's teams directly
    const teams = await this.teamRepository.find({
      where: [
        { members: { user: { user_id: user.user_id } } },
        { leader: { user_id: user.user_id } },
      ],
      select: ['id', 'name'],
    });

    const teamIds = teams.map((team) => team.id);

    // 2. Fetch Projects, Tasks, and all Activity dependencies concurrently
    let projects: Project[] = [];
    let tasks: Task[] = [];

    // We only fetch tasks/projects if the user is actually on a team
    if (teamIds.length > 0) {
      [projects, tasks] = await Promise.all([
        this.projectRepository.find({
          where: { teams: { id: In(teamIds) } },
          select: ['id', 'name', 'status', 'duration'],
        }),
        this.taskRepository.find({
          where: [
            { teams: { id: In(teamIds) } },
            { project: { teams: { id: In(teamIds) } } }, // Fetches tasks linked to projects on these teams
          ],
          relations: ['project'], // Needed to map projectName for deadlines
        }),
      ]);
    }

    // 3. Fetch all communication metrics concurrently
    const [activities, sentMessages, callsAsCaller, callsAsRecipient] =
      await Promise.all([
        this.activityRepository.find({
          where: {
            businessId,
            module: 'tasks',
            action: ActivityAction.UPDATED,
            userId: user.user_id,
            createdAt: Between(range.startDate, range.endDate),
          },
          order: { createdAt: 'DESC' },
        }),
        this.messageRepository.count({
          // Count directly instead of fetching entities
          where: {
            senderId: user.user_id,
            createdAt: Between(range.startDate, range.endDate),
          },
        }),
        this.callRepository.find({
          where: {
            callerId: user.user_id,
            createdAt: Between(range.startDate, range.endDate),
          },
        }),
        this.callRepository.find({
          where: {
            recipientId: user.user_id,
            createdAt: Between(range.startDate, range.endDate),
          },
        }),
      ]);

    // --- Start Calculations (Everything below is purely in-memory math on flat arrays) ---

    const now = new Date();
    const dueTasks = tasks.filter((task) => Boolean(task.due_date));

    const overdueTasks = dueTasks.filter((task) => {
      const dueDate = new Date(task.due_date);
      return (
        !Number.isNaN(dueDate.getTime()) &&
        dueDate < now &&
        task.status !== TaskStatus.COMPLETED
      );
    });

    const upcomingDeadlines = dueTasks
      .filter((task) => {
        const dueDate = new Date(task.due_date);
        return (
          !Number.isNaN(dueDate.getTime()) &&
          dueDate >= now &&
          task.status !== TaskStatus.COMPLETED
        );
      })
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
      )
      .slice(0, 10)
      .map((task) => ({
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.project?.id ?? null, // Greatly simplified since we requested 'project' relation
        projectName: task.project?.name ?? null,
        dueDate: task.due_date,
        status: task.status,
        priority: task.priority,
      }));

    const activityAnalytics = this.calculateUserActivityAnalytics(activities);
    const calls = [...callsAsCaller, ...callsAsRecipient];

    // Deduplicate calls (if a user called themselves, for example)
    const uniqueCalls = Array.from(
      new Map(calls.map((call) => [call.id, call])).values(),
    );
    const endedCalls = uniqueCalls.filter(
      (call) => call.status === CallStatus.ENDED,
    );

    const totalMeetingMinutes = endedCalls.reduce((sum, call) => {
      if (!call.answeredAt || !call.endedAt) return sum;
      const durationMs =
        new Date(call.endedAt).getTime() - new Date(call.answeredAt).getTime();
      return sum + Math.max(0, Math.round(durationMs / 60000));
    }, 0);

    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    );
    const tasksCompletedInRange = completedTasks.filter(
      (t) => t.updated_at >= range.startDate && t.updated_at <= range.endDate,
    );

    return {
      userId: user.user_id,
      userName: user.name,
      userEmail: user.email,
      role: toRoleResponse(user.role),
      teams: teams.map((team) => ({ teamId: team.id, teamName: team.name })),
      projects: projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        status: p.status,
        duration: p.duration,
      })),
      analytics: {
        productivityIndex: activityAnalytics.productivityIndex,
        statusMovementScore: activityAnalytics.statusMovementScore,
        taskUpdateScore: activityAnalytics.taskUpdateScore,
        statusChanges: activityAnalytics.statusChanges,
        taskUpdates: activityAnalytics.taskUpdates,
        totalActivities: activities.length,
      },
      taskAnalytics: {
        totalAssignedTasks: tasks.length,
        completedTasks: completedTasks.length,
        tasksCompletedInRange: tasksCompletedInRange.length,
        todoTasks: tasks.filter((t) => t.status === TaskStatus.TODO).length,
        inProgressTasks: tasks.filter(
          (t) => t.status === TaskStatus.IN_PROGRESS,
        ).length,
        reviewTasks: tasks.filter((t) => t.status === TaskStatus.REVIEW).length,
        onHoldTasks: tasks.filter((t) => t.status === TaskStatus.ON_HOLD)
          .length,
        blockedTasks: tasks.filter((t) => t.status === TaskStatus.BLOCKED)
          .length,
        completionRate:
          tasks.length > 0
            ? Number(((completedTasks.length / tasks.length) * 100).toFixed(2))
            : 0,
        weightedCompletedScore: tasksCompletedInRange.reduce(
          (score, task) => score + this.getPriorityWeight(task.priority),
          0,
        ),
      },
      deadlineAnalytics: {
        totalTasksWithDeadline: dueTasks.length,
        overdueTasks: overdueTasks.length,
        upcomingDeadlines,
      },
      meetingAnalytics: {
        totalCalls: uniqueCalls.length,
        callsStarted: callsAsCaller.length,
        callsReceived: callsAsRecipient.length,
        endedCalls: endedCalls.length,
        missedCalls: uniqueCalls.filter((c) => c.status === CallStatus.MISSED)
          .length,
        rejectedCalls: uniqueCalls.filter(
          (c) => c.status === CallStatus.REJECTED,
        ).length,
        totalMeetingMinutes,
      },
      collaborationAnalytics: {
        messagesSent: sentMessages,
      },
      recentActivities: activityAnalytics.recentActivities,
    };
  }

  private calculateUserActivityAnalytics(activities: ActivityLog[]) {
    const analytics = {
      productivityIndex: 0,
      statusMovementScore: 0,
      taskUpdateScore: 0,
      statusChanges: 0,
      taskUpdates: 0,
      recentActivities: [],
    };

    for (const activity of activities) {
      let score = 0;

      if (activity.module === 'tasks' && activity.fieldChanged === 'status') {
        const key = `${activity.oldValue}->${activity.newValue}`;
        score = this.statusTransitionWeights[key] ?? 0;
        analytics.statusMovementScore += score;
        analytics.statusChanges += 1;
      } else if (activity.module === 'tasks' && activity.fieldChanged) {
        score = this.taskUpdateWeights[activity.fieldChanged] ?? 0;
        analytics.taskUpdateScore += score;
        analytics.taskUpdates += 1;
      }

      analytics.productivityIndex += score;
      analytics.recentActivities.push({
        activityId: activity.id,
        action: activity.action,
        module: activity.module,
        entityType: activity.entityType,
        entityId: activity.entityId,
        entityName: activity.entityName,
        fieldChanged: activity.fieldChanged,
        oldValue: activity.oldValue,
        newValue: activity.newValue,
        score,
        createdAt: activity.createdAt,
      });
    }

    return analytics;
  }

  private buildEmployeesAnalyticsSummary(employees: any[]) {
    const totalEmployees = employees.length;
    const totalProductivity = employees.reduce(
      (sum, employee) => sum + employee.analytics.productivityIndex,
      0,
    );
    const totalTasks = employees.reduce(
      (sum, employee) => sum + employee.taskAnalytics.totalAssignedTasks,
      0,
    );
    const completedTasks = employees.reduce(
      (sum, employee) => sum + employee.taskAnalytics.completedTasks,
      0,
    );

    return {
      totalEmployees,
      averageProductivityIndex:
        totalEmployees > 0
          ? Number((totalProductivity / totalEmployees).toFixed(2))
          : 0,
      totalAssignedTasks: totalTasks,
      completedTasks,
      averageTaskCompletionRate:
        totalTasks > 0
          ? Number(((completedTasks / totalTasks) * 100).toFixed(2))
          : 0,
      totalOverdueTasks: employees.reduce(
        (sum, employee) => sum + employee.deadlineAnalytics.overdueTasks,
        0,
      ),
      totalMessagesSent: employees.reduce(
        (sum, employee) => sum + employee.collaborationAnalytics.messagesSent,
        0,
      ),
      totalCalls: employees.reduce(
        (sum, employee) => sum + employee.meetingAnalytics.totalCalls,
        0,
      ),
      topEmployee:
        [...employees].sort(
          (first, second) =>
            second.analytics.productivityIndex -
            first.analytics.productivityIndex,
        )[0] ?? null,
    };
  }

  private toClientSummary(client: Client) {
    return {
      clientId: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      company: client.company,
      priority: client.priority,
      paymentType: client.paymentType,
      amount: Number(client.amount ?? 0),
      createdAt: client.created_at,
      updatedAt: client.updated_at,
    };
  }

  private toProjectSummary(project: Project) {
    const tasks = project.tasks ?? [];
    return {
      projectId: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      duration: project.duration,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      client: project.client ? this.toClientSummary(project.client) : null,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(
        (task) => task.status === TaskStatus.COMPLETED,
      ).length,
      totalTeams: project.teams?.length ?? 0,
    };
  }

  private toTeamSummary(team: Team) {
    const tasks = team.tasks ?? [];
    return {
      teamId: team.id,
      name: team.name,
      description: team.description,
      leader: team.leader
        ? {
            userId: team.leader.user_id,
            name: team.leader.name,
            email: team.leader.email,
          }
        : null,
      members: (team.members ?? []).map((member) => ({
        memberId: member.id,
        userId: member.user?.user_id,
        name: member.user?.name,
        email: member.user?.email,
      })),
      totalMembers: team.members?.length ?? 0,
      totalProjects: team.projects?.length ?? 0,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(
        (task) => task.status === TaskStatus.COMPLETED,
      ).length,
    };
  }

  private toTaskSummary(task: Task) {
    return {
      taskId: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      project: task.project
        ? {
            projectId: task.project.id,
            name: task.project.name,
          }
        : null,
      teams: (task.teams ?? []).map((team) => ({
        teamId: team.id,
        name: team.name,
      })),
    };
  }

  private buildTaskSummary(tasks: Task[]) {
    const uniqueTasks = Array.from(
      new Map((tasks ?? []).map((task) => [task.id, task])).values(),
    );
    const totalTasks = uniqueTasks.length;
    const completedTasks = uniqueTasks.filter(
      (task) => task.status === TaskStatus.COMPLETED,
    ).length;

    return {
      totalTasks,
      completedTasks,
      todoTasks: uniqueTasks.filter((task) => task.status === TaskStatus.TODO)
        .length,
      inProgressTasks: uniqueTasks.filter(
        (task) => task.status === TaskStatus.IN_PROGRESS,
      ).length,
      reviewTasks: uniqueTasks.filter(
        (task) => task.status === TaskStatus.REVIEW,
      ).length,
      onHoldTasks: uniqueTasks.filter(
        (task) => task.status === TaskStatus.ON_HOLD,
      ).length,
      blockedTasks: uniqueTasks.filter(
        (task) => task.status === TaskStatus.BLOCKED,
      ).length,
      completionRate:
        totalTasks > 0
          ? Number(((completedTasks / totalTasks) * 100).toFixed(2))
          : 0,
    };
  }

  private toActivityResponse(activity: ActivityLog) {
    return {
      activityId: activity.id,
      action: activity.action,
      module: activity.module,
      entityType: activity.entityType,
      entityId: activity.entityId,
      entityName: activity.entityName,
      fieldChanged: activity.fieldChanged,
      oldValue: activity.oldValue,
      newValue: activity.newValue,
      userId: activity.userId,
      userName: activity.userName,
      userEmail: activity.userEmail,
      description: activity.description,
      createdAt: activity.createdAt,
    };
  }

  private async calculateClientAnalyticsForClient(
    client: Client,
    businessId: number,
    range: DateRange,
  ) {
    const [projects, feedbacks, replyStats] = await Promise.all([
      this.projectRepository.find({
        where: {
          business: { business_id: businessId },
          client: { id: client.id },
        },
        relations: ['tasks'],
      }),
      this.clientFeedbackRepository.find({
        where: {
          businessId,
          clientId: client.id,
          createdAt: Between(range.startDate, range.endDate),
        },
        relations: ['replies'],
      }),
      this.getClientFeedbackReplyStats(client.id, businessId, range),
    ]);

    const tasks = projects.flatMap((project) => project.tasks ?? []);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (task) => task.status === TaskStatus.COMPLETED,
    ).length;
    const taskCompletionRate =
      totalTasks > 0
        ? Number(((completedTasks / totalTasks) * 100).toFixed(2))
        : 0;

    const completedProjects = projects.filter((project) => {
      const projectTasks = project.tasks ?? [];
      return (
        projectTasks.length > 0 &&
        projectTasks.every((task) => task.status === TaskStatus.COMPLETED)
      );
    }).length;

    const totalFeedback = feedbacks.length;
    const ratings = feedbacks
      .map((feedback) => Number(feedback.starRating))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    const averageRating =
      ratings.length > 0
        ? Number(
            (
              ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            ).toFixed(2),
          )
        : 0;

    const openFeedback = feedbacks.filter(
      (feedback) => feedback.status === ClientFeedbackStatus.OPEN,
    ).length;
    const inProgressFeedback = feedbacks.filter(
      (feedback) => feedback.status === ClientFeedbackStatus.IN_PROGRESS,
    ).length;
    const inReviewFeedback = feedbacks.filter(
      (feedback) => feedback.status === ClientFeedbackStatus.IN_REVIEW,
    ).length;
    const resolvedFeedback = feedbacks.filter(
      (feedback) => feedback.status === ClientFeedbackStatus.RESOLVED,
    ).length;
    const rejectedFeedback = feedbacks.filter(
      (feedback) => feedback.status === ClientFeedbackStatus.REJECTED,
    ).length;
    const feedbackWithReplies = feedbacks.filter(
      (feedback) => (feedback.replies ?? []).length > 0,
    ).length;

    const averageRatingPercent =
      averageRating > 0 ? (averageRating / 5) * 100 : 0;
    const resolvedFeedbackRate =
      totalFeedback > 0
        ? Number(((resolvedFeedback / totalFeedback) * 100).toFixed(2))
        : 0;
    const responseRate =
      totalFeedback > 0
        ? Number(((feedbackWithReplies / totalFeedback) * 100).toFixed(2))
        : 0;
    const healthScore = Number(
      (
        taskCompletionRate * 0.4 +
        averageRatingPercent * 0.3 +
        resolvedFeedbackRate * 0.2 +
        responseRate * 0.1
      ).toFixed(2),
    );

    return {
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      company: client.company,
      paymentType: client.paymentType,
      amount: Number(client.amount ?? 0),
      totalProjects: projects.length,
      activeProjects: Math.max(projects.length - completedProjects, 0),
      completedProjects,
      totalTasks,
      completedTasks,
      taskCompletionRate,
      totalFeedback,
      averageRating,
      openFeedback,
      inProgressFeedback,
      inReviewFeedback,
      resolvedFeedback,
      rejectedFeedback,
      feedbackWithReplies,
      unansweredFeedback: Math.max(totalFeedback - feedbackWithReplies, 0),
      replyCount: replyStats.replyCount,
      lastReplyAt: replyStats.lastReplyAt,
      responseRate,
      resolvedFeedbackRate,
      healthScore,
    };
  }

  private async getClientFeedbackReplyStats(
    clientId: string,
    businessId: number,
    range: DateRange,
  ) {
    const replyCount = await this.clientFeedbackReplyRepository
      .createQueryBuilder('reply')
      .innerJoin('reply.feedback', 'feedback')
      .where('reply.business_id = :businessId', { businessId })
      .andWhere('feedback.client_id = :clientId', { clientId })
      .andWhere('reply.created_at BETWEEN :startDate AND :endDate', {
        startDate: range.startDate,
        endDate: range.endDate,
      })
      .getCount();

    const lastReply = await this.clientFeedbackReplyRepository
      .createQueryBuilder('reply')
      .innerJoin('reply.feedback', 'feedback')
      .where('reply.business_id = :businessId', { businessId })
      .andWhere('feedback.client_id = :clientId', { clientId })
      .andWhere('reply.created_at BETWEEN :startDate AND :endDate', {
        startDate: range.startDate,
        endDate: range.endDate,
      })
      .orderBy('reply.created_at', 'DESC')
      .getOne();

    return {
      replyCount,
      lastReplyAt: lastReply?.createdAt ?? null,
    };
  }

  private buildClientAnalyticsSummary(clients: any[]) {
    const totalClients = clients.length;
    const averageHealthScore =
      totalClients > 0
        ? Number(
            (
              clients.reduce((sum, client) => sum + client.healthScore, 0) /
              totalClients
            ).toFixed(2),
          )
        : 0;
    const totalPortfolioValue = clients.reduce(
      (sum, client) => sum + Number(client.amount ?? 0),
      0,
    );
    const totalFeedback = clients.reduce(
      (sum, client) => sum + client.totalFeedback,
      0,
    );
    const totalReplies = clients.reduce(
      (sum, client) => sum + client.replyCount,
      0,
    );

    return {
      totalClients,
      totalPortfolioValue,
      averageHealthScore,
      totalFeedback,
      totalReplies,
      topClient:
        [...clients].sort(
          (first, second) => second.healthScore - first.healthScore,
        )[0] ?? null,
      atRiskClients: clients.filter((client) => client.healthScore < 50).length,
    };
  }

  private async saveRecord(input: {
    businessId: number;
    metricType: AnalyticsMetricType;
    scopeType?: string | null;
    scopeId?: string | null;
    scopeName?: string | null;
    periodStart: Date;
    periodEnd: Date;
    score: number;
    data: Record<string, any>;
    calculatedAt: Date;
  }): Promise<AnalyticsRecord> {
    return this.analyticsHelper.saveRecord(input);
  }

  private async findFreshOverviewRecord(
    businessId: number,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsRecord | null> {
    return this.analyticsHelper.findFreshOverviewRecord(businessId, query);
  }

  private async findFreshClientAnalyticsRecord(
    businessId: number,
    query: AnalyticsQueryDto,
    range: DateRange,
  ): Promise<AnalyticsRecord | null> {
    return this.analyticsHelper.findFreshClientAnalyticsRecord(
      businessId,
      query,
      range,
    );
  }

  private async getBusinessContext(reqUser: any) {
    return this.analyticsHelper.getBusinessContext(reqUser);
  }

  private async getBusinessEmployeeOrFail(userId: number, businessId: number) {
    return this.analyticsHelper.getBusinessEmployeeOrFail(userId, businessId);
  }

  private isClientUser(user: User) {
    return this.analyticsHelper.isClientUser(user);
  }

  private toEmployeeBrief(user: User) {
    return {
      userId: user.user_id,
      userName: user.name,
      userEmail: user.email,
      role: toRoleResponse(user.role),
    };
  }

  private resolveDateRange(query: AnalyticsQueryDto): DateRange {
    return this.analyticsHelper.resolveDateRange(query);
  }

  private resolveQuarterRange(query: AnalyticsQueryDto): DateRange {
    return this.analyticsHelper.resolveQuarterRange(query);
  }

  private getPreviousRange(range: DateRange): DateRange {
    return this.analyticsHelper.getPreviousRange(range);
  }

  private getPriorityWeight(priority?: TaskPriority): number {
    return this.analyticsHelper.getPriorityWeight(priority);
  }
}
