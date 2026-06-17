import { BadRequestException, CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { TeamsService } from "src/teams/teams.service";
import { UserService } from "src/user/user.service";
import { ProjectsService } from "./projects.service";
import { BusinessService } from "../business/business.service";


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
          throw new UnauthorizedException('User is not authorized to modify this team');
        }
        this.logger.log(`User has right role: ${user.email}`);
        return true;
    }
}

@Injectable()
export class projectCreationGuard implements CanActivate{
    private readonly logger = new Logger(projectCreationGuard.name)

    constructor(
        private readonly projectService: ProjectsService,
        private readonly userService: UserService,
        private readonly teamService: TeamsService
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking if the request is valid for creation.`);
        const request = context.switchToHttp().getRequest();
        const body = request.body;
        const name = body.name;
        const user = request.user;

        const teamIds = body.teams;

        if(!Array.isArray(teamIds)){
            this.logger.error(`Teams payload is invalid.`);
            throw new BadRequestException('Teams must be provided as an array.');
        }

        if(teamIds.length === 0){
            this.logger.error(`No teams provided.`);
            throw new BadRequestException('No teams provided.');
        }

        this.logger.log(`Getting business.`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessId = userDetails.business.business_id;

        this.logger.log(`Checking if teams are valid.`);
        const teamsValidity = await this.teamService.findValidTeams(teamIds, businessId);

        if(!teamsValidity){
            this.logger.error(`Teams are not valid for this business.`);
            throw new BadRequestException('Teams are not valid for this business.');
        }

        this.logger.log(`Checking if project name is valid.`);
        const projectValidity = await this.projectService.findProjectsName(name);

        if(!projectValidity){
            this.logger.error(`Project with this name already exists.`);
            throw new BadRequestException('Project with this name already exists.');
        }
        this.logger.log(`Request is valid for this business.`);
        return true;
    }
    
}

@Injectable()
export class projectTeamsUpdateGuard implements CanActivate{
    private readonly logger = new Logger(projectTeamsUpdateGuard.name)

    constructor(
        private readonly projectService: ProjectsService,
        private readonly userService: UserService,
        private readonly teamService: TeamsService
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking if the request is valid for creation.`);
        const request = context.switchToHttp().getRequest();
        const body = request.body;
        const projectId = body.project_id;
        const user = request.user;

        const teamIds = body.team_id;

        if(teamIds.length === 0){
            this.logger.error(`No teams provided.`);
            throw new BadRequestException('No teams provided.');
        }

        this.logger.log(`Getting business.`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessId = userDetails.business.business_id;

        this.logger.log(`Checking if teams are valid.`);
        const teamsValidity = await this.teamService.findValidTeams(teamIds, businessId);

        if(!teamsValidity){
            this.logger.error(`Teams are not valid for this business.`);
            throw new BadRequestException('Teams are not valid for this business.');
        }

        this.logger.log(`Checking if project name is valid.`);
        const projectValidity = await this.projectService.findProjectsById(projectId);

        if(!projectValidity){
            this.logger.error(`Project does not exists.`);
            throw new NotFoundException('Project does not exists.');
        }
        this.logger.log(`Request is valid for this project.`);
        return true;
    }
    
}

@Injectable()
export class validRequestForTask implements CanActivate{
    private readonly logger = new Logger(validRequestForTask.name)

    constructor(
        private readonly projectService: ProjectsService,
        private readonly userService: UserService,
        private readonly teamService: TeamsService
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking if the request is valid for creation.`);
        const request = context.switchToHttp().getRequest();
        const body = request.body;
        const user = request.user;
        const projectId = body.projectId;
        const rawTeamIds = body.assigneeId;
        console.log(body)

        if(!projectId){
            this.logger.error(`Project ID not provided.`);
            throw new BadRequestException('Project ID is required.');
        }

        if(!rawTeamIds){
            this.logger.error(`No teams provided.`);
            throw new BadRequestException('No teams provided.');
        }


        this.logger.log(`Getting business.`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessId = userDetails.business.business_id;

        this.logger.log(`Checking if project belongs to business.`);
        const projects = await this.projectService.findAllByBusiness(user);
        const projectValid = projects.some((project) => project.id === projectId);

        if(!projectValid){
            this.logger.error(`Project does not belong to this business.`);
            throw new BadRequestException('Project is not valid for this business.');
        }

        this.logger.log(`Checking if teams are valid.`);
        const teamsValidity = await this.teamService.findValidTeam(rawTeamIds, businessId);

        if(!teamsValidity){
            this.logger.error(`Teams are not valid for this business.`);
            throw new BadRequestException('Teams are not valid for this business.');
        }

        this.logger.log(`Request is valid for this business.`);
        return true;
    }
    
}
@Injectable()
export class validRequestForTaskUpdate implements CanActivate{
    private readonly logger = new Logger(validRequestForTaskUpdate.name)

    constructor(
        private readonly projectService: ProjectsService,
        private readonly userService: UserService,
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking if the request is valid for creation.`);
        const request = context.switchToHttp().getRequest();
        const body = request.body;
        const user = request.user;

        const task = body.id;

        if(!task){
            this.logger.error(`No task provided.`);
            throw new BadRequestException('No task provided.');
        }

        this.logger.log(`Getting business.`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessId = userDetails.business.business_id;

        this.logger.log(`Checking if task is valid.`);
        const taskValidity = await this.projectService.findOneTask(task);

        if(!taskValidity){
            this.logger.error(`Task is not valid for this business.`);
            throw new BadRequestException('Task is not valid for this business.');
        }

        if(taskValidity.project.business.business_id !== businessId){
            this.logger.error(`Task does not belong to this business.`);
            throw new BadRequestException('Task is not valid for this business.');
        }
        this.logger.log(`Request is valid for this business.`);
        return true;
    }
    
}

@Injectable()
export class validRequestForTaskDelete implements CanActivate{
    private readonly logger = new Logger(validRequestForTaskDelete.name)

    constructor(
        private readonly projectService: ProjectsService,
        private readonly userService: UserService,
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking if the request is valid for deletion.`);
        const request = context.switchToHttp().getRequest();
        const params = request.params
        const user = request.user;

        const task = params.id;

        if(!task){
            this.logger.error(`No task provided.`);
            throw new BadRequestException('No task provided.');
        }

        this.logger.log(`Getting business.`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessId = userDetails.business.business_id;

        this.logger.log(`Checking if task is valid.`);
        const taskValidity = await this.projectService.findOneTask(task);

        if(!taskValidity){
            this.logger.error(`Task is not valid for this business.`);
            throw new HttpException('Task is not valid for this business.', HttpStatus.NOT_FOUND);
        }

        if(taskValidity.project.business.business_id !== businessId){
            this.logger.error(`Task does not belong to this business.`);
            throw new HttpException('Task is not valid for this business.', HttpStatus.NOT_FOUND);
        }
        this.logger.log(`Request is valid for this business.`);
        return true;
    }
    
}

@Injectable()
export class ValidProjectGuard implements CanActivate{
    private readonly logger = new Logger(ValidProjectGuard.name)

    constructor(
        private readonly userService: UserService,
        private readonly businessService: BusinessService
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking if the request is valid for project.`);
        const request = context.switchToHttp().getRequest();
        const params = request.query
        const user = request.user;

        const projectName = params.projectName;

        if(!projectName){
            this.logger.error(`No project provided.`);
            throw new BadRequestException('No project provided.');
        }

        this.logger.log(`Getting business.`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessProjects = userDetails.business.business_id;
        const projects = await this.businessService.getProjectsWithBusiness(businessProjects);

        this.logger.log(`Checking if project is valid.`);
        const projectValidity = projects.projects.some((project) => project.name === projectName);

        if(!projectValidity){
            this.logger.error(`Project is not valid for this business.`);
            throw new NotFoundException('Project is not valid for this business.');
        }
        this.logger.log(`Request is valid for this business.`);
        return true;
    }
    
}

@Injectable()
export class validRequestForTaskList implements CanActivate{
    private readonly logger = new Logger(validRequestForTaskList.name)

    constructor(
        private readonly projectService: ProjectsService,
        private readonly userService: UserService,
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking if the request is valid for task listing.`);
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const projectId = request.query.projectId;

        if(!projectId){
            this.logger.error(`Project ID not provided.`);
            throw new BadRequestException('Project ID is required.');
        }

        this.logger.log(`Getting business.`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessId = userDetails.business.business_id;

        this.logger.log(`Checking if project is valid.`);
        const project = await this.projectService.findProjectsById(projectId);

        if(!project || project.business.business_id !== businessId){
            this.logger.error(`Project is not valid for this business.`);
            throw new NotFoundException('Project is not valid for this business.');
        }

        this.logger.log(`Request is valid for this business.`);
        return true;
    }
}
