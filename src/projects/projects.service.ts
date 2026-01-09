import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserService } from 'src/user/user.service';
import { BusinessService } from 'src/business/business.service';
import { TeamsService } from 'src/teams/teams.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { ClientsService } from 'src/clients/clients.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

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

  async createTask(reqObj: any, createTaskDto: CreateTaskDto): Promise<any> {
    this.logger.log(`Creating task: ${createTaskDto.title}`);
    console.log(createTaskDto.dueDate)
    try {
      // Project/business validation handled by guards.
      const project = await this.projectRepository.findOne({ 
        where: { id: createTaskDto.projectId },
        relations: ['business']
      });

      const teams = await this.teamService.findOne(createTaskDto.assignedID)
      
      // Create the task
      const task = this.taskRepository.create({
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        due_date: createTaskDto.dueDate,
        priority: createTaskDto.priority,
        project: project,
        teams: [teams]
      });
      
      const result = await this.taskRepository.save(task);
      this.logger.log(`Task created successfully.`);
      return {
        message: "New task created successfully.",
        task: result
      };
    } catch (error) {
      this.logger.error(`Error creating task: ${createTaskDto.title}`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async updateTask(updateTaskDto: UpdateTaskDto): Promise<any> {
    this.logger.log(`Getting task for updating with id: ${updateTaskDto.id}`);
    try {
      const task = await this.findOneTask(updateTaskDto.id)

      if (updateTaskDto.title !== undefined) {
        task.title = updateTaskDto.title;
      }
      if (updateTaskDto.description !== undefined) {
        task.description = updateTaskDto.description;
      }
      if (updateTaskDto.status !== undefined) {
        task.status = updateTaskDto.status;
      }
      if (updateTaskDto.priority !== undefined) {
        task.priority = updateTaskDto.priority;
      }
      if (updateTaskDto.due_date !== undefined) {
        task.due_date = updateTaskDto.due_date;
      }

      const result = await this.taskRepository.save(task);
      this.logger.log(`Task updated successfully.`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error updating task: ${updateTaskDto.id}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async getProjects(token: string): Promise<any> {
    this.logger.log(`Getting projects for token: ${token}`);
    try {
      const project = await this.projectRepository.findOne({ 
        where: { id: token },
        relations: ['tasks', 'tasks.teams']
      });

      if (!project) {
        throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
      }

      return project.tasks;
    } catch (error) {
      this.logger.error(`Error getting projects for token: ${token}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async getProjectTeams(reqObj: any, projectId: string): Promise<any> {
    this.logger.log(`Getting project teams for project: ${projectId}`);
    try {
      const project = await this.projectRepository.findOne({ 
        where: { id: projectId },
        relations: ['teams']
      });
      
      if (!project) {
        throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
      }
      
      return project.teams;
    } catch (error) {
      this.logger.error(`Error getting project teams: ${projectId}`, error.message);
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

  findOneTask(id: string): Promise<Task> {
    this.logger.log(`Getting task: ${id}`);
    try {
      const task = this.taskRepository.findOne({
        where: { id },
        relations: ['project', 'teams'],
      });

      if (!task) {
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
      }

      return task;
    } catch (error) {
      this.logger.error(`Error getting task: ${id}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

}
