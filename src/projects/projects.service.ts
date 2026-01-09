import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserService } from '../user/user.service';
import { BusinessService } from '../business/business.service';
import { TeamsService } from '../teams/teams.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { ClientsService } from '../clients/clients.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly userService: UserService,
    private  businessService: BusinessService,
    private readonly teamService: TeamsService,
    private readonly clientService: ClientsService
  ) {}


  // This Function creates new projects.
  async create(reqObj: any, createProjectDto: CreateProjectDto) {
    this.logger.log(`Creating a new project: ${createProjectDto.name}`);
    try {
      this.logger.log(`Finding Business`);
      const business = await this.businessService.getBusiness(reqObj.email);
      this.logger.log(`Finding Teams`);
      const teams = await this.teamService.findTeams(createProjectDto.teams)
      this.logger.log(`Finding Client`);
      const client = await this.clientService.findOneClientThroughId(createProjectDto.client)
      this.logger.log(`Creating Project`);
      const obj ={
        name: createProjectDto.name,
        description: createProjectDto.description,
        status: createProjectDto.status,
        business,
        teams,
        client
      }
      const project = this.projectRepository.create(obj);
      const result = await this.projectRepository.save(project);
      this.logger.log(`Project created successfully.`);
      return {
        message: "New project created successfully.",
        project: result
      }
    } catch (error) {
      this.logger.error(`Error creating project: ${createProjectDto.name}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // This function finds all Projects respective of their business.
  async findAllByBusiness(reqObj: any): Promise<Project[]> {
    this.logger.log(`Getting all projects for business: ${reqObj.email}`);
    try {
      this.logger.log(`Finding Business`);
      const user = await this.userService.getUserWithBusiness(reqObj.email);
      const businessId = user.business.business_id;

      const projects = await this.projectRepository.find({where: {business: {business_id: businessId}}, relations:['tasks','teams', 'client']});
      return projects;
    } catch (error) {
      this.logger.error(`Error getting all projects for business: ${reqObj.email}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }


  findOne(id: number) {
    return `This action returns a #${id} project`;
  }

  update(id: number, updateProjectDto: UpdateProjectDto) {
    return `This action updates a #${id} project`;
  }

  remove(id: number) {
    return `This action removes a #${id} project`;
  }




  // Helper Functions
  async findProjectsName(name: string): Promise<boolean> { 
    const project = await this.projectRepository.findOne({where:{name}});
    if(project){
      return false;
    }
    return true;
  }

  findAll() {
    try {
      this.logger.log(`Getting all projects`);
      const projects = this.projectRepository.find({relations:['tasks']});
      return projects;
    } catch (error) {
      this.logger.error(`Error getting all projects`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

}
