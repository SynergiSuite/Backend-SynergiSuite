import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { Logger } from '@nestjs/common';
import { hasAccessRoleIds } from '../roles/role-access';
import { MilestoneHelper } from './milestone.helper';

@Injectable()
export class ValidRequestForMilestonesCreation implements CanActivate {
  private readonly logger = new Logger(ValidRequestForMilestonesCreation.name);
  constructor(
    private readonly milestoneHelper: MilestoneHelper,
    private readonly projectService: ProjectsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(`Checking if user already has a business: ${user.email}`);
    const userDetails = await this.milestoneHelper.getUserWithBusiness(
      user.email,
    );

    const projectId = body.projectId;

    if (!projectId) {
      this.logger.error(`Project ID is required for milestone creation.`);
      throw new UnauthorizedException('Project ID is required');
    }

    const projectDetails =
      await this.projectService.findOneWithBusiness(projectId);

    this.logger.log(`Checking project is valid: ${projectId}`);
    if (!projectDetails) {
      this.logger.error(`Project not found: ${projectId}`);
      throw new UnauthorizedException('Project not found');
    }

    this.logger.log(
      `Checking if project belongs to business: ${projectDetails.id}`,
    );
    if (
      projectDetails.business.business_id !== userDetails.business.business_id
    ) {
      this.logger.error(
        `User does not have access to project: ${projectDetails.id}`,
      );
      throw new UnauthorizedException('User does not have access to project');
    }

    request.body.projectId = projectId;

    this.logger.log(`Valid request for milestones creation: ${user.email}`);
    return true;
  }
}

@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly milestoneHelper: MilestoneHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`Checking if user has right role: ${user.email}`);
    const userDetails = await this.milestoneHelper.getUserWithBusiness(
      user.email,
    );
    if (!hasAccessRoleIds(userDetails.role, [1, 2])) {
      this.logger.error(`User does not have right role: ${user.email}`);
      throw new UnauthorizedException(
        'User is not authorized to add new client.',
      );
    }
    this.logger.log(`User has right role: ${user.email}`);
    return true;
  }
}

@Injectable()
export class ValidProjectForBusiness implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(
    private readonly milestoneHelper: MilestoneHelper,
    private readonly projectService: ProjectsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId =
      request.query.projectId ||
      request.params.projectId ||
      request.params.project;

    if (!projectId) {
      this.logger.log(
        `No projectId provided. Returning all milestones request.`,
      );
      return true;
    }

    this.logger.log(
      `Checking if project exists for milestones fetch. user: ${user.email}, projectId: ${projectId}`,
    );
    const project = await this.projectService.findProjectsById(projectId);
    const userDetails = await this.milestoneHelper.getUserWithBusiness(
      user.email,
    );

    if (!project) {
      this.logger.error(
        `No project found for milestone fetch. user: ${user.email}, projectId: ${projectId}`,
      );
      throw new NotFoundException('No Project found associated with this ID.');
    }

    if (project.business?.business_id !== userDetails?.business?.business_id) {
      this.logger.error(
        `Project does not belong to this business. user: ${user.email}, projectId: ${projectId}, projectBusinessId: ${project.business?.business_id}, userBusinessId: ${userDetails?.business?.business_id}`,
      );
      throw new UnauthorizedException(
        'Invalid request. Project does not belong to this business.',
      );
    }
    this.logger.log(
      `Project is valid for milestone fetch. user: ${user.email}, projectId: ${projectId}`,
    );
    return true;
  }
}

@Injectable()
export class ValidRequestForMilestoneUpdation implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly milestoneHelper: MilestoneHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;

    await this.milestoneHelper.getUserWithBusiness(user.email);
    const milestoneDetails = await this.milestoneHelper.findOneWithId(body.id);

    if (!milestoneDetails) {
      this.logger.error(`No milestone found: ${user.email}`);
      throw new NotFoundException(
        'No Milestone found associated with this ID.',
      );
    }
    return true;
  }
}

@Injectable()
export class ValidRequestForMilestoneDeletion implements CanActivate {
  private readonly logger = new Logger(ValidRequestForMilestoneDeletion.name);

  constructor(private readonly milestoneHelper: MilestoneHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const milestoneId = request.params?.id;

    if (!user?.email) {
      throw new UnauthorizedException('User not found');
    }

    if (!milestoneId) {
      throw new BadRequestException('Milestone ID is required');
    }

    const [userDetails, milestone] = await Promise.all([
      this.milestoneHelper.getUserWithBusiness(user.email),
      this.milestoneHelper.findOneWithBusiness(milestoneId),
    ]);

    if (!milestone) {
      this.logger.error(`No milestone found: ${milestoneId}`);
      throw new NotFoundException(
        'No Milestone found associated with this ID.',
      );
    }

    if (
      milestone.project?.business?.business_id !==
      userDetails?.business?.business_id
    ) {
      this.logger.error(
        `Milestone does not belong to user's business. user: ${user.email}, milestoneId: ${milestoneId}`,
      );
      throw new UnauthorizedException(
        'Invalid request. Milestone does not belong to this business.',
      );
    }

    return true;
  }
}
