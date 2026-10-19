import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Task, TaskStatus } from '../projects/entities/task.entity';
import { UserHelper } from '../user/user.helper';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';
import { ClientFeedback } from '../client_feedback/entities/client-feedback.entity';

@Injectable()
export class ClientsHelper {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientFeedback)
    private readonly clientFeedbackRepository: Repository<ClientFeedback>,
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

  async createClient(createClientDto: CreateClientDto, user: any) {
    const record = this.clientRepository.create({
      name: createClientDto.name,
      email: createClientDto.email,
      phone: createClientDto.phone,
      address: createClientDto.address,
      company: createClientDto.company,
      priority: createClientDto.priority,
      paymentType: createClientDto.paymentType,
      amount: createClientDto.amount,
      business: user.business,
    });

    return await this.clientRepository.save(record);
  }

  async findAllByBusinessId(businessId: number) {
    return await this.clientRepository.find({
      where: { business: { business_id: businessId } },
    });
  }

  async findOne(id: string) {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: ['business', 'projects'],
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async findOneClientThroughId(id: string) {
    return await this.clientRepository.findOne({
      where: { id },
      relations: ['business'],
    });
  }

  async findOneByBusiness(id: string, businessId: number) {
    const client = await this.clientRepository.findOne({
      where: {
        id,
        business: { business_id: businessId },
      },
      relations: ['business'],
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async findOneForDelete(id: string, businessId: number) {
    const client = await this.clientRepository.findOne({
      where: {
        id,
        business: { business_id: businessId },
      },
      relations: [
        'business',
        'projects',
        'projects.tasks',
        'projects.tasks.teams',
        'projects.teams',
      ],
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async clientExistsByName(businessId: number, name: string) {
    const client = await this.clientRepository.findOne({
      where: {
        name,
        business: { business_id: businessId },
      },
      relations: ['business'],
    });

    return Boolean(client);
  }

  async updateClient(client: Client, updateClientDto: UpdateClientDto) {
    Object.assign(client, updateClientDto);
    return await this.clientRepository.save(client);
  }

  async removeClientWithProjects(client: Client) {
    await this.clientRepository.manager.transaction(async (manager) => {
      if (client.projects?.length) {
        for (const project of client.projects) {
          if (project.tasks?.length) {
            for (const task of project.tasks) {
              if (task.teams?.length) {
                await manager
                  .createQueryBuilder()
                  .relation(Task, 'teams')
                  .of(task)
                  .remove(task.teams);
              }
            }
          }

          if (project.teams?.length) {
            await manager
              .createQueryBuilder()
              .relation(Project, 'teams')
              .of(project)
              .remove(project.teams);
          }
        }

        await manager.remove(Project, client.projects);
      }

      await manager.remove(Client, client);
    });
  }

  async getClientDetailsWithRelations(clientId: string, businessId: number) {
    const [client, feedbacks] = await Promise.all([
      this.clientRepository.findOne({
        where: {
          id: clientId,
          business: { business_id: businessId },
        },
        relations: [
          'business',
          'projects',
          'projects.teams',
          'projects.teams.leader',
          'projects.milestones',
          'projects.tasks',
          'projects.tasks.assignee',
          'projects.tasks.milestone',
          'projects.tasks.teams',
        ],
      }),
      this.clientFeedbackRepository.find({
        where: {
          clientId,
          businessId,
        },
        relations: ['createdBy', 'replies', 'replies.createdBy'],
        order: { createdAt: 'DESC' },
      }),
    ]);

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    const formattedData = this.formatClientDetailResponse(client, feedbacks);
    return this.recursiveSanitize(formattedData);
  }

  parseSafeDate(dateVal: string | Date | null | undefined): Date | null {
    if (!dateVal) return null;
    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
    return isNaN(date.getTime()) ? null : date;
  }

  calculateDaysRemaining(
    targetDate: Date,
    referenceDate: Date = new Date(),
  ): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil(
      (targetDate.getTime() - referenceDate.getTime()) / msPerDay,
    );
  }

  recursiveSanitize<T>(
    input: T,
    keysToOmit: Set<string> = new Set([
      'password_hash',
      'token_digest',
      'salary',
      'password',
    ]),
  ): T {
    if (input === null || input === undefined) {
      return input;
    }

    if (input instanceof Date) {
      return input;
    }

    if (Array.isArray(input)) {
      return input.map((item) =>
        this.recursiveSanitize(item, keysToOmit),
      ) as unknown as T;
    }

    if (typeof input === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        if (!keysToOmit.has(key)) {
          sanitized[key] = this.recursiveSanitize(value, keysToOmit);
        }
      }
      return sanitized as T;
    }

    return input;
  }

  recursiveFormatReplies(replies: any[]): any[] {
    if (!Array.isArray(replies) || replies.length === 0) {
      return [];
    }

    return [...replies]
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      })
      .map((reply) => ({
        id: reply.id,
        message: reply.message,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        createdBy: reply.createdBy
          ? {
              userId: reply.createdBy.user_id,
              name: reply.createdBy.name,
              email: reply.createdBy.email,
            }
          : null,
        replies: reply.replies
          ? this.recursiveFormatReplies(reply.replies)
          : undefined,
      }));
  }

  formatClientDetailResponse(client: Client, feedbacks: ClientFeedback[]) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const feedbacksByStatus: Record<string, number> = {
      open: 0,
      in_progress: 0,
      in_review: 0,
      resolved: 0,
      rejected: 0,
    };
    let ratingSum = 0;
    let ratingCount = 0;

    const formattedFeedbacks = (feedbacks ?? []).map((fb) => {
      if (fb.status) {
        const statusKey = String(fb.status).toLowerCase();
        feedbacksByStatus[statusKey] =
          (feedbacksByStatus[statusKey] || 0) + 1;
      }
      if (typeof fb.starRating === 'number' && !isNaN(fb.starRating)) {
        ratingSum += fb.starRating;
        ratingCount += 1;
      }

      return {
        id: fb.id,
        titleOfFeedback: fb.titleOfFeedback,
        feedback: fb.feedback,
        feedbackType: fb.feedbackType,
        status: fb.status,
        starRating: fb.starRating ?? null,
        targetType: fb.targetType,
        typeId: fb.typeId,
        createdAt: fb.createdAt,
        updatedAt: fb.updatedAt,
        createdBy: fb.createdBy
          ? {
              userId: fb.createdBy.user_id,
              name: fb.createdBy.name,
              email: fb.createdBy.email,
            }
          : null,
        replies: this.recursiveFormatReplies(fb.replies ?? []),
      };
    });

    const averageRating =
      ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : null;

    let totalMilestonesCount = 0;
    let totalTasksCount = 0;
    let completedTasksCount = 0;
    let pendingTasksCount = 0;
    let overdueTasksCount = 0;

    const allUpcomingDeadlines: any[] = [];

    const formattedProjects = (client.projects ?? []).map((project) => {
      const projectMilestones = project.milestones ?? [];
      const projectTasks = project.tasks ?? [];

      totalMilestonesCount += projectMilestones.length;
      totalTasksCount += projectTasks.length;

      const tasksByMilestoneId = new Map<string, Task[]>();
      for (const task of projectTasks) {
        if (task.milestone?.id) {
          const list = tasksByMilestoneId.get(task.milestone.id) || [];
          list.push(task);
          tasksByMilestoneId.set(task.milestone.id, list);
        }
      }

      const upcomingProjectMilestones: any[] = [];
      const formattedMilestones = projectMilestones.map((milestone) => {
        const endDateParsed = this.parseSafeDate(milestone.end_date);
        const isUpcoming = endDateParsed
          ? endDateParsed.getTime() >= startOfToday.getTime()
          : false;
        const isOverdue = endDateParsed
          ? endDateParsed.getTime() < startOfToday.getTime()
          : false;
        const daysRemaining = endDateParsed
          ? this.calculateDaysRemaining(endDateParsed, now)
          : null;

        const milestoneTasks = tasksByMilestoneId.get(milestone.id) || [];
        const completedMilestoneTasks = milestoneTasks.filter(
          (t) => t.status === TaskStatus.COMPLETED,
        ).length;

        const milestoneData = {
          id: milestone.id,
          name: milestone.name,
          end_date: milestone.end_date,
          endDateParsed: endDateParsed ? endDateParsed.toISOString() : null,
          isUpcoming,
          isOverdue,
          daysRemaining,
          tasksCount: milestoneTasks.length,
          completedTasksCount: completedMilestoneTasks,
          created_at: milestone.created_at,
          updated_at: milestone.updated_at,
          tasks: milestoneTasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date,
          })),
        };

        if (isUpcoming) {
          const deadlineItem = {
            type: 'milestone',
            id: milestone.id,
            title: milestone.name,
            dueDate: milestone.end_date,
            dueDateParsed: endDateParsed ? endDateParsed.toISOString() : null,
            daysRemaining,
            status: 'upcoming',
            projectId: project.id,
            projectName: project.name,
          };
          upcomingProjectMilestones.push(deadlineItem);
          allUpcomingDeadlines.push(deadlineItem);
        }

        return milestoneData;
      });

      const upcomingProjectTasks: any[] = [];
      const formattedTasks = projectTasks.map((task) => {
        const isCompleted = task.status === TaskStatus.COMPLETED;
        if (isCompleted) {
          completedTasksCount += 1;
        } else {
          pendingTasksCount += 1;
        }

        const dueDateParsed = this.parseSafeDate(task.due_date);
        const isUpcoming =
          dueDateParsed && !isCompleted
            ? dueDateParsed.getTime() >= startOfToday.getTime()
            : false;
        const isOverdue =
          dueDateParsed && !isCompleted
            ? dueDateParsed.getTime() < startOfToday.getTime()
            : false;

        if (isOverdue) {
          overdueTasksCount += 1;
        }

        const daysRemaining = dueDateParsed
          ? this.calculateDaysRemaining(dueDateParsed, now)
          : null;

        const taskData = {
          id: task.id,
          title: task.title,
          description: task.description ?? null,
          status: task.status,
          priority: task.priority ?? null,
          due_date: task.due_date ?? null,
          dueDateParsed: dueDateParsed ? dueDateParsed.toISOString() : null,
          isUpcoming,
          isOverdue,
          daysRemaining,
          milestoneId: task.milestone?.id ?? null,
          milestoneName: task.milestone?.name ?? null,
          created_at: task.created_at,
          updated_at: task.updated_at,
          assignee: task.assignee
            ? {
                userId: task.assignee.user_id,
                name: task.assignee.name,
                email: task.assignee.email,
              }
            : null,
          teams: (task.teams ?? []).map((t) => ({
            id: t.id,
            name: t.name,
          })),
        };

        if (isUpcoming) {
          const deadlineItem = {
            type: 'task',
            id: task.id,
            title: task.title,
            dueDate: task.due_date,
            dueDateParsed: dueDateParsed ? dueDateParsed.toISOString() : null,
            daysRemaining,
            status: task.status,
            priority: task.priority,
            projectId: project.id,
            projectName: project.name,
            milestoneId: task.milestone?.id ?? null,
            milestoneName: task.milestone?.name ?? null,
            assignee: task.assignee
              ? {
                  userId: task.assignee.user_id,
                  name: task.assignee.name,
                  email: task.assignee.email,
                }
              : null,
          };
          upcomingProjectTasks.push(deadlineItem);
          allUpcomingDeadlines.push(deadlineItem);
        }

        return taskData;
      });

      upcomingProjectTasks.sort((a, b) => {
        const timeA = a.dueDateParsed
          ? new Date(a.dueDateParsed).getTime()
          : Infinity;
        const timeB = b.dueDateParsed
          ? new Date(b.dueDateParsed).getTime()
          : Infinity;
        return timeA - timeB;
      });

      upcomingProjectMilestones.sort((a, b) => {
        const timeA = a.dueDateParsed
          ? new Date(a.dueDateParsed).getTime()
          : Infinity;
        const timeB = b.dueDateParsed
          ? new Date(b.dueDateParsed).getTime()
          : Infinity;
        return timeA - timeB;
      });

      return {
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        status: project.status,
        duration: project.duration,
        created_at: project.created_at,
        updated_at: project.updated_at,
        teams: (project.teams ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          leader: t.leader
            ? {
                userId: t.leader.user_id,
                name: t.leader.name,
                email: t.leader.email,
              }
            : null,
        })),
        milestones: formattedMilestones,
        tasks: formattedTasks,
        upcomingDueDates: {
          tasks: upcomingProjectTasks,
          milestones: upcomingProjectMilestones,
        },
      };
    });

    allUpcomingDeadlines.sort((a, b) => {
      const timeA = a.dueDateParsed
        ? new Date(a.dueDateParsed).getTime()
        : Infinity;
      const timeB = b.dueDateParsed
        ? new Date(b.dueDateParsed).getTime()
        : Infinity;
      return timeA - timeB;
    });

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        company: client.company,
        priority: client.priority,
        paymentType: client.paymentType,
        amount: Number(client.amount),
        created_at: client.created_at,
        updated_at: client.updated_at,
        business: client.business
          ? {
              business_id: client.business.business_id,
              name: client.business.name,
            }
          : null,
      },
      summary: {
        totalProjects: formattedProjects.length,
        totalMilestones: totalMilestonesCount,
        totalTasks: totalTasksCount,
        completedTasks: completedTasksCount,
        pendingTasks: pendingTasksCount,
        overdueTasks: overdueTasksCount,
        totalFeedbacks: formattedFeedbacks.length,
        feedbacksByStatus,
        averageFeedbackRating: averageRating,
        upcomingDueDatesCount: allUpcomingDeadlines.length,
      },
      feedbacks: formattedFeedbacks,
      projects: formattedProjects,
      upcomingDueDates: allUpcomingDeadlines,
    };
  }
}

