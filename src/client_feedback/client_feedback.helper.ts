import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { Milestone } from '../milestone/entities/milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../projects/entities/task.entity';
import { getAccessRoleName, hasAccessRoleIds } from '../roles/role-access';
import { UserHelper } from '../user/user.helper';
import { CreateClientFeedbackReplyDto } from './dto/create-client-feedback-reply.dto';
import { CreateClientFeedbackDto } from './dto/create-client-feedback.dto';
import { GetClientFeedbackDto } from './dto/get-client-feedback.dto';
import { UpdateClientFeedbackDto } from './dto/update-client-feedback.dto';
import { ClientFeedbackReply } from './entities/client-feedback-reply.entity';
import { ClientFeedback } from './entities/client-feedback.entity';
import { ClientFeedbackTargetType } from './enums/client_feedback.enums';

@Injectable()
export class ClientFeedbackHelper {
  constructor(
    @InjectRepository(ClientFeedback)
    private readonly feedbackRepository: Repository<ClientFeedback>,
    @InjectRepository(ClientFeedbackReply)
    private readonly feedbackReplyRepository: Repository<ClientFeedbackReply>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Milestone)
    private readonly milestoneRepository: Repository<Milestone>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly userHelper: UserHelper,
  ) {}

  async getRequestContext(reqUser: any) {
    const user = await this.userHelper.getUserWithBusinessDetail(reqUser.email);

    if (!user?.business?.business_id) {
      throw new ForbiddenException('User is not linked with any business.');
    }

    return {
      user,
      businessId: user.business.business_id,
      roleName: getAccessRoleName(user.role),
    };
  }

  async createFeedback(
    createClientFeedbackDto: CreateClientFeedbackDto,
    client: Client,
    context: any,
  ) {
    const feedback = this.feedbackRepository.create({
      ...createClientFeedbackDto,
      client,
      clientId: client.id,
      businessId: context.businessId,
      createdBy: context.user,
      createdById: context.user.user_id,
    });

    return await this.feedbackRepository.save(feedback);
  }

  async getFeedbackList(
    query: GetClientFeedbackDto,
    businessId: number,
    clientId?: string,
  ) {
    const queryBuilder = this.feedbackRepository
      .createQueryBuilder('feedback')
      .leftJoinAndSelect('feedback.client', 'client')
      .leftJoinAndSelect('feedback.createdBy', 'createdBy')
      .where('feedback.business_id = :businessId', { businessId })
      .orderBy('feedback.createdAt', 'DESC');

    if (clientId) {
      queryBuilder.andWhere('feedback.client_id = :clientId', { clientId });
    }

    if (query.targetType) {
      queryBuilder.andWhere('feedback.target_type = :targetType', {
        targetType: query.targetType,
      });
    }

    if (query.typeId) {
      queryBuilder.andWhere('feedback.type_id = :typeId', {
        typeId: query.typeId,
      });
    }

    if (query.feedbackType) {
      queryBuilder.andWhere('feedback.feedback_type = :feedbackType', {
        feedbackType: query.feedbackType,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('feedback.status = :status', {
        status: query.status,
      });
    }

    const page = this.getFeedbackPage(query.page);
    const limit = 5;
    const [feedbacks, totalFeedbacks] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { feedbacks, totalFeedbacks, page, limit };
  }

  async getFeedbackForRequest(id: string, context: any) {
    const feedback = await this.feedbackRepository.findOne({
      where: { id, businessId: context.businessId },
      relations: ['client', 'createdBy'],
    });

    if (!feedback) {
      throw new NotFoundException('Client feedback not found.');
    }

    if (this.isClientRole(context.roleName)) {
      this.validateClientAccess(context, feedback.client);
    }

    return feedback;
  }

  async getClientForBusiness(clientId: string, businessId: number) {
    const client = await this.clientRepository.findOne({
      where: {
        id: clientId,
        business: { business_id: businessId },
      },
      relations: ['business'],
    });

    if (!client) {
      throw new BadRequestException('Client does not exist for this business.');
    }

    return client;
  }

  async getClientByEmail(email: string, businessId: number) {
    const client = await this.clientRepository.findOne({
      where: {
        email: email?.trim().toLowerCase(),
        business: { business_id: businessId },
      },
      relations: ['business'],
    });

    if (!client) {
      throw new ForbiddenException('Client profile not found for this user.');
    }

    return client;
  }

  validateClientAccess(context: any, client: Client) {
    if (!this.isClientRole(context.roleName)) {
      return;
    }

    const userEmail = context.user.email?.trim().toLowerCase();
    const clientEmail = client.email?.trim().toLowerCase();

    if (!clientEmail || clientEmail !== userEmail) {
      throw new ForbiddenException(
        'Client users can only access their own feedback.',
      );
    }
  }

  async validateTargetBelongsToClient(
    targetType: ClientFeedbackTargetType,
    typeId: string,
    clientId: string,
    businessId: number,
  ) {
    const project = await this.getProjectForFeedbackTarget(targetType, typeId);
    this.validateProjectClient(project, clientId, businessId);
  }

  async getProjectForFeedbackTarget(
    targetType: ClientFeedbackTargetType,
    typeId: string,
  ) {
    if (targetType === ClientFeedbackTargetType.PROJECT) {
      return await this.projectRepository.findOne({
        where: { id: typeId },
        relations: ['business', 'client'],
      });
    }

    if (targetType === ClientFeedbackTargetType.MILESTONE) {
      const milestone = await this.milestoneRepository.findOne({
        where: { id: typeId },
        relations: ['project', 'project.business', 'project.client'],
      });

      if (!milestone?.project) {
        throw new BadRequestException('Milestone target is not valid.');
      }

      return milestone.project;
    }

    if (targetType === ClientFeedbackTargetType.TASK) {
      const task = await this.taskRepository.findOne({
        where: { id: typeId },
        relations: ['project', 'project.business', 'project.client'],
      });

      if (!task?.project) {
        throw new BadRequestException('Task target is not valid.');
      }

      return task.project;
    }

    throw new BadRequestException('Invalid feedback target type.');
  }

  validateProjectClient(
    project: Project | undefined,
    clientId: string | undefined,
    businessId: number,
  ) {
    if (!project || project.business?.business_id !== businessId) {
      throw new BadRequestException('Feedback target is not valid.');
    }

    if (!project.client || project.client.id !== clientId) {
      throw new BadRequestException(
        'Feedback target is not linked to this client.',
      );
    }
  }

  async createReply(
    feedback: ClientFeedback,
    createClientFeedbackReplyDto: CreateClientFeedbackReplyDto,
    context: any,
  ) {
    const reply = this.feedbackReplyRepository.create({
      feedback,
      feedbackId: feedback.id,
      message: createClientFeedbackReplyDto.message,
      businessId: context.businessId,
      createdBy: context.user,
      createdById: context.user.user_id,
    });

    return await this.feedbackReplyRepository.save(reply);
  }

  async saveFeedback(feedback: ClientFeedback) {
    return await this.feedbackRepository.save(feedback);
  }

  async updateFeedback(
    feedback: ClientFeedback,
    updateClientFeedbackDto: UpdateClientFeedbackDto,
    client: Client,
  ) {
    Object.assign(feedback, updateClientFeedbackDto, {
      client,
      clientId: client.id,
    });

    return await this.feedbackRepository.save(feedback);
  }

  async findReplies(feedbackId: string, businessId: number) {
    return await this.feedbackReplyRepository.find({
      where: {
        feedbackId,
        businessId,
      },
      relations: ['createdBy'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async removeFeedback(feedback: ClientFeedback) {
    return await this.feedbackRepository.remove(feedback);
  }

  isClientRole(roleName?: string) {
    return roleName === 'client';
  }

  isFounderOrManager(context: any) {
    return (
      context.roleName === 'founder' ||
      context.roleName === 'manager' ||
      hasAccessRoleIds(context.user?.role, [1, 2])
    );
  }

  private getFeedbackPage(page?: number) {
    const parsedPage = Number(page);
    return Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.floor(parsedPage)
      : 1;
  }
}
