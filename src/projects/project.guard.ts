import { BadRequestException, CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { TeamsService } from "../teams/teams.service";
import { UserService } from "../user/user.service";
import { ProjectsService } from "./projects.service";


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
        console.log(name)
        const user = request.user;

        const teamIds = body.teams;

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