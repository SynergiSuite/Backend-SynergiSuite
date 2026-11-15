import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { ActivityService } from '../activity/activity.service';
import { CreateClientFeedbackReplyDto } from './dto/create-client-feedback-reply.dto';
import { CreateClientFeedbackDto } from './dto/create-client-feedback.dto';
import { GetClientFeedbackDto } from './dto/get-client-feedback.dto';
import { SubmitClientFeedbackDto } from './dto/submit-client-feedback.dto';
import { UpdateClientFeedbackDto } from './dto/update-client-feedback.dto';
import { ClientFeedbackReply } from './entities/client-feedback-reply.entity';
import { ClientFeedback } from './entities/client-feedback.entity';
import { ClientFeedbackHelper } from './client_feedback.helper';
import {
  ClientFeedbackStatus,
  ClientFeedbackTargetType,
} from './enums/client_feedback.enums';

@Injectable()
export class ClientFeedbackService {
  private readonly logger = new Logger(ClientFeedbackService.name);

  constructor(
    private readonly clientFeedbackHelper: ClientFeedbackHelper,
    private readonly activityService: ActivityService,
  ) {}

  async create(createClientFeedbackDto: CreateClientFeedbackDto, reqUser: any) {
    this.logger.log(
      `Creating client feedback for ${createClientFeedbackDto.targetType}: ${createClientFeedbackDto.typeId}`,
    );
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    const client = await this.clientFeedbackHelper.getClientForBusiness(
      createClientFeedbackDto.clientId,
      context.businessId,
    );

    this.clientFeedbackHelper.validateClientAccess(context, client);
    await this.clientFeedbackHelper.validateTargetBelongsToClient(
      createClientFeedbackDto.targetType,
      createClientFeedbackDto.typeId,
      client.id,
      context.businessId,
    );

    const savedFeedback = await this.clientFeedbackHelper.createFeedback(
      createClientFeedbackDto,
      client,
      context,
    );

    await this.activityService.log({
      action: ActivityAction.CREATED,
      module: 'client_feedback',
      entityType: 'client_feedback',
      entityId: savedFeedback.id,
      entityName: savedFeedback.titleOfFeedback,
      actor: context.user,
      businessId: context.businessId,
      after: this.toActivityPayload(savedFeedback),
      metadata: {
        clientId: savedFeedback.clientId,
        targetType: savedFeedback.targetType,
        typeId: savedFeedback.typeId,
      },
    });

    return savedFeedback;
  }

  async submitFeedback(
    submitClientFeedbackDto: SubmitClientFeedbackDto,
    reqUser: any,
  ) {
    const targetType =
      submitClientFeedbackDto.targetType ?? ClientFeedbackTargetType.PROJECT;
    const typeId =
      submitClientFeedbackDto.typeId ?? submitClientFeedbackDto.projectId;
    const titleOfFeedback =
      submitClientFeedbackDto.titleOfFeedback ??
      submitClientFeedbackDto.feedbackTitle;
    const feedbackType =
      submitClientFeedbackDto.feedbackType ?? submitClientFeedbackDto.category;
    const starRating =
      submitClientFeedbackDto.starRating ?? submitClientFeedbackDto.rating;

    if (!typeId) {
      throw new BadRequestException(
        'Project ID or feedback target is required.',
      );
    }

    if (!titleOfFeedback) {
      throw new BadRequestException('Feedback title is required.');
    }

    if (!feedbackType) {
      throw new BadRequestException('Feedback type is required.');
    }

    this.logger.log(`Submitting client feedback for ${targetType}: ${typeId}`);

    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    const project = await this.clientFeedbackHelper.getProjectForFeedbackTarget(
      targetType,
      typeId,
    );

    this.clientFeedbackHelper.validateProjectClient(
      project,
      project?.client?.id,
      context.businessId,
    );
    this.clientFeedbackHelper.validateClientAccess(context, project.client);

    return await this.create(
      {
        clientId: project.client.id,
        titleOfFeedback,
        feedback: submitClientFeedbackDto.feedback,
        feedbackType,
        targetType,
        typeId,
        status: ClientFeedbackStatus.IN_PROGRESS,
        starRating,
      },
      reqUser,
    );
  }

  async findAll(query: GetClientFeedbackDto, reqUser: any) {
    this.logger.log('Fetching client feedback list');
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    let clientId = query.clientId;

    if (this.clientFeedbackHelper.isClientRole(context.roleName)) {
      const client = await this.clientFeedbackHelper.getClientByEmail(
        context.user.email,
        context.businessId,
      );
      clientId = client.id;
    }

    const { feedbacks, totalFeedbacks, page, limit } =
      await this.clientFeedbackHelper.getFeedbackList(
        query,
        context.businessId,
        clientId,
      );

    return {
      data: feedbacks,
      meta: {
        totalItems: totalFeedbacks,
        itemCount: feedbacks.length,
        itemsPerPage: limit,
        currentPage: page,
        totalPages: Math.ceil(totalFeedbacks / limit),
      },
    };
  }

  async findClientFeedback(reqUser: any, query: GetClientFeedbackDto) {
    this.logger.log('Fetching requesting client feedback list');
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    let clientId = query.clientId;

    if (this.clientFeedbackHelper.isFounderOrManager(context)) {
      if (query.clientId) {
        await this.clientFeedbackHelper.getClientForBusiness(
          query.clientId,
          context.businessId,
        );
      }
    } else {
      const client = await this.clientFeedbackHelper.getClientByEmail(
        context.user.email,
        context.businessId,
      );
      clientId = client.id;
    }

    const { feedbacks, totalFeedbacks, page, limit } =
      await this.clientFeedbackHelper.getFeedbackList(
        query,
        context.businessId,
        clientId,
      );

    return {
      data: feedbacks,
      meta: {
        totalItems: totalFeedbacks,
        itemCount: feedbacks.length,
        itemsPerPage: limit,
        currentPage: page,
        totalPages: Math.ceil(totalFeedbacks / limit),
      },
    };
  }

  async findOne(id: string, reqUser: any) {
    this.logger.log(`Fetching client feedback: ${id}`);
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    return await this.clientFeedbackHelper.getFeedbackForRequest(id, context);
  }

  async createReply(
    id: string,
    createClientFeedbackReplyDto: CreateClientFeedbackReplyDto,
    reqUser: any,
  ) {
    this.logger.log(`Creating client feedback reply: ${id}`);
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    const feedback = await this.clientFeedbackHelper.getFeedbackForRequest(
      id,
      context,
    );
    const before = this.toActivityPayload(feedback);

    const savedReply = await this.clientFeedbackHelper.createReply(
      feedback,
      createClientFeedbackReplyDto,
      context,
    );

    if (
      createClientFeedbackReplyDto.status &&
      createClientFeedbackReplyDto.status !== feedback.status
    ) {
      feedback.status = createClientFeedbackReplyDto.status;
      const savedFeedback =
        await this.clientFeedbackHelper.saveFeedback(feedback);

      await this.activityService.logFieldChanges(
        {
          action: ActivityAction.UPDATED,
          module: 'client_feedback',
          entityType: 'client_feedback',
          entityId: savedFeedback.id,
          entityName: savedFeedback.titleOfFeedback,
          actor: context.user,
          businessId: context.businessId,
          metadata: {
            clientId: savedFeedback.clientId,
            replyId: savedReply.id,
          },
        },
        before,
        this.toActivityPayload(savedFeedback),
        ['status'],
      );
    }

    await this.activityService.log({
      action: ActivityAction.CREATED,
      module: 'client_feedback',
      entityType: 'client_feedback_reply',
      entityId: savedReply.id,
      entityName: feedback.titleOfFeedback,
      actor: context.user,
      businessId: context.businessId,
      after: this.toReplyResponse(savedReply),
      metadata: {
        feedbackId: feedback.id,
        clientId: feedback.clientId,
      },
    });

    return this.toReplyResponse(savedReply);
  }

  async findReplies(id: string, reqUser: any) {
    this.logger.log(`Fetching client feedback replies: ${id}`);
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    await this.clientFeedbackHelper.getFeedbackForRequest(id, context);

    const replies = await this.clientFeedbackHelper.findReplies(
      id,
      context.businessId,
    );

    return replies.map((reply) => this.toReplyResponse(reply));
  }

  async update(
    id: string,
    updateClientFeedbackDto: UpdateClientFeedbackDto,
    reqUser: any,
  ) {
    this.logger.log(`Updating client feedback: ${id}`);
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    const feedback = await this.clientFeedbackHelper.getFeedbackForRequest(
      id,
      context,
    );
    const before = this.toActivityPayload(feedback);

    const clientId = updateClientFeedbackDto.clientId ?? feedback.clientId;
    const targetType =
      updateClientFeedbackDto.targetType ?? feedback.targetType;
    const typeId = updateClientFeedbackDto.typeId ?? feedback.typeId;
    const client = await this.clientFeedbackHelper.getClientForBusiness(
      clientId,
      context.businessId,
    );

    this.clientFeedbackHelper.validateClientAccess(context, client);
    await this.clientFeedbackHelper.validateTargetBelongsToClient(
      targetType,
      typeId,
      client.id,
      context.businessId,
    );

    const savedFeedback = await this.clientFeedbackHelper.updateFeedback(
      feedback,
      updateClientFeedbackDto,
      client,
    );
    const after = this.toActivityPayload(savedFeedback);

    await this.activityService.logFieldChanges(
      {
        action: ActivityAction.UPDATED,
        module: 'client_feedback',
        entityType: 'client_feedback',
        entityId: savedFeedback.id,
        entityName: savedFeedback.titleOfFeedback,
        actor: context.user,
        businessId: context.businessId,
        metadata: {
          clientId: savedFeedback.clientId,
          targetType: savedFeedback.targetType,
          typeId: savedFeedback.typeId,
        },
      },
      before,
      after,
      [
        'titleOfFeedback',
        'feedback',
        'feedbackType',
        'targetType',
        'typeId',
        'status',
        'clientId',
        'starRating',
      ],
    );

    return savedFeedback;
  }

  async remove(id: string, reqUser: any) {
    this.logger.log(`Deleting client feedback: ${id}`);
    const context = await this.clientFeedbackHelper.getRequestContext(reqUser);
    const feedback = await this.clientFeedbackHelper.getFeedbackForRequest(
      id,
      context,
    );
    const before = this.toActivityPayload(feedback);

    await this.clientFeedbackHelper.removeFeedback(feedback);

    await this.activityService.log({
      action: ActivityAction.DELETED,
      module: 'client_feedback',
      entityType: 'client_feedback',
      entityId: id,
      entityName: feedback.titleOfFeedback,
      actor: context.user,
      businessId: context.businessId,
      before,
      metadata: {
        clientId: feedback.clientId,
        targetType: feedback.targetType,
        typeId: feedback.typeId,
      },
    });

    return { message: 'Client feedback deleted successfully' };
  }

  private toActivityPayload(feedback: ClientFeedback) {
    return {
      id: feedback.id,
      titleOfFeedback: feedback.titleOfFeedback,
      starRating: feedback.starRating,
      feedback: feedback.feedback,
      feedbackType: feedback.feedbackType,
      targetType: feedback.targetType,
      typeId: feedback.typeId,
      status: feedback.status,
      clientId: feedback.clientId,
    };
  }

  private toReplyResponse(reply: ClientFeedbackReply) {
    return {
      id: reply.id,
      feedbackId: reply.feedbackId,
      message: reply.message,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      replier: reply.createdBy
        ? {
            userId: reply.createdBy.user_id,
            name: reply.createdBy.name,
            email: reply.createdBy.email,
          }
        : null,
    };
  }
}
