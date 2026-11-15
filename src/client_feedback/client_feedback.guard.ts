import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { Project } from '../projects/entities/project.entity';
import { getAccessRoleName, hasAccessRoleIds } from '../roles/role-access';
import { UserHelper } from '../user/user.helper';
import { ClientFeedbackTargetType } from './enums/client_feedback.enums';

@Injectable()
export class ValidClientFeedbackSubmissionGuard implements CanActivate {
  private readonly logger = new Logger(ValidClientFeedbackSubmissionGuard.name);

  constructor(
    private readonly userHelper: UserHelper,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { targetType, typeId } = request.body;
    const projectId =
      request.body.projectId ||
      (targetType === ClientFeedbackTargetType.PROJECT ? typeId : undefined);

    this.logger.log(
      `Validating client feedback submission for project: ${projectId ?? 'target-only'}`,
    );

    if (!projectId) {
      if (targetType && typeId) {
        return true;
      }
      throw new BadRequestException(
        'Project ID or feedback target is required.',
      );
    }

    const userDetails = await this.userHelper.getUserWithBusinessDetail(
      user.email,
    );

    if (!userDetails?.business?.business_id) {
      throw new ForbiddenException('User is not linked with any business.');
    }

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['business', 'client'],
    });

    if (
      !project ||
      project.business?.business_id !== userDetails.business.business_id
    ) {
      throw new BadRequestException(
        'Project does not exist for this business.',
      );
    }

    if (!project.client) {
      throw new BadRequestException('Project is not linked with any client.');
    }

    const roleName = getAccessRoleName(userDetails.role);

    if (roleName === 'client') {
      const userEmail = userDetails.email?.trim().toLowerCase();
      const clientEmail = project.client.email?.trim().toLowerCase();

      if (!clientEmail || clientEmail !== userEmail) {
        throw new ForbiddenException(
          'Client users can only submit feedback for their own projects.',
        );
      }
    }

    return true;
  }
}

@Injectable()
export class ClientHasOngoingProjectGuard implements CanActivate {
  private readonly logger = new Logger(ClientHasOngoingProjectGuard.name);

  constructor(
    private readonly userHelper: UserHelper,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`Checking client ongoing projects: ${user.email}`);

    const userDetails = await this.userHelper.getUserWithBusinessDetail(
      user.email,
    );

    if (!userDetails?.business?.business_id) {
      throw new ForbiddenException('User is not linked with any business.');
    }

    if (this.isFounderOrManager(userDetails)) {
      return true;
    }

    const client = await this.clientRepository.findOne({
      where: {
        email: userDetails.email?.trim().toLowerCase(),
        business: { business_id: userDetails.business.business_id },
      },
      relations: ['business'],
    });

    if (!client) {
      throw new NotFoundException('User has no on going project');
    }

    const project = await this.projectRepository.findOne({
      where: {
        business: { business_id: userDetails.business.business_id },
        client: { id: client.id },
      },
      relations: ['business', 'client'],
    });

    if (!project) {
      throw new NotFoundException('User has no on going project');
    }

    return true;
  }

  private isFounderOrManager(userDetails: any) {
    const roleName = getAccessRoleName(userDetails.role);
    return (
      roleName === 'founder' ||
      roleName === 'manager' ||
      hasAccessRoleIds(userDetails.role, [1, 2])
    );
  }
}
