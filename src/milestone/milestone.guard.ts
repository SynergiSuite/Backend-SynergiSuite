import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ProjectsService } from '../projects/projects.service';
import { Logger } from '@nestjs/common';
import { MilestoneService } from './milestone.service';

@Injectable()
export class ValidRequestForMilestonesCreation implements CanActivate {
  private readonly logger = new Logger(ValidRequestForMilestonesCreation.name);
  constructor(private readonly userService: UserService, private readonly projectService: ProjectsService, private readonly milestoneService: MilestoneService) { 
  }
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user 
    const body = request.body 


    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(`Checking if user already has a business: ${user.email}`);
    const userDetails = await this.userService.getUserWithBusiness(user.email);

    if (!body.projectId) {
      this.logger.log(`Creating milestone without project for user: ${user.email}`);
      return true;
    }

    const projectDetails = await this.projectService.findOneWithBusiness(body.projectId);

    const milestoneDetails = await this.milestoneService.findOneWithName(body.name, body.projectId);

    this.logger.log(`Checking project is valid: ${body.projectId}`);
    if (!projectDetails) {
      this.logger.error(`Project not found: ${body.projectId}`);
      throw new UnauthorizedException('Project not found');
    }

    this.logger.log(`Checking if project belongs to business: ${body.projectId}`);
    if (projectDetails.business.business_id !== userDetails.business.business_id) {
      this.logger.error(`User does not have access to project: ${body.projectId}`);
      throw new UnauthorizedException('User does not have access to project');
    }

    this.logger.log(`Checking milestone already exists: ${body.projectId}`);
    if (milestoneDetails) {
      this.logger.error(`Milestone already exists: ${body.name}`);
      throw new UnauthorizedException('Milestone already exists');
    }

    this.logger.log(`Valid request for milestones creation: ${user.email}`)
    return true;
  } 
}

@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        this.logger.log(`Checking if user has right role: ${user.email}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        if(userDetails.role.id !== 1 && userDetails.role.id !== 2){
          this.logger.error(`User does not have right role: ${user.email}`);
          throw new UnauthorizedException('User is not authorized to add new client.');
        }
        this.logger.log(`User has right role: ${user.email}`);
        return true;
    }
}


@Injectable()
export class ValidProjectForBusiness implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly userService: UserService, private readonly projectService: ProjectsService) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const projectId = request.query.projectId || request.params.projectId || request.params.project;

        if(!projectId) {
          this.logger.log(`No projectId provided. Returning all milestones request.`);
          return true;
        }

        this.logger.log(`Checking if project exists for milestones fetch. user: ${user.email}, projectId: ${projectId}`);
        const project = await this.projectService.findProjectsById(projectId)
        const userDetails = await this.userService.findUserWithBusiness(user.email)

        if(!project) {
          this.logger.error(`No project found for milestone fetch. user: ${user.email}, projectId: ${projectId}`);
          throw new NotFoundException("No Project found associated with this ID.")
        }

        if(project.business.business_id != userDetails.business.business_id ){
          this.logger.error(`Project does not belong to this business. user: ${user.email}, projectId: ${projectId}`);
          throw new UnauthorizedException('Invalid request. Project does not belong to this business.');
        }
        this.logger.log(`Project is valid for milestone fetch. user: ${user.email}, projectId: ${projectId}`);
        return true;
    }
}

@Injectable()
export class ValidRequestForMilestoneUpdation implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly userService: UserService, private readonly milestoneService: MilestoneService) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const body = request.body;

        const userDetails = await this.userService.findUserWithBusiness(user.email)
        const milestoneDetails = await this.milestoneService.findOneWithId(body.id);

        if(!milestoneDetails) {
          this.logger.error(`No milestone found: ${user.email}`);
          throw new NotFoundException("No Milestone found associated with this ID.")
        }
        return true;
    }
}
