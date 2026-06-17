import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserService } from '../user/user.service';
import { BusinessService } from '../business/business.service';
import { TeamsService } from '../teams/teams.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { ClientsService } from 'src/clients/clients.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { MilestoneService } from 'src/milestone/milestone.service';

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
    private readonly clientService: ClientsService,
    private readonly milestoneService: MilestoneService
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
        duration: createProjectDto.duration,
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
    try {
      // Project/business validation handled by guards.
      const project = await this.projectRepository.findOne({ 
        where: { id: createTaskDto.projectId },
        relations: ['business']
      });

      const milestone = createTaskDto.milestoneId
        ? await this.milestoneService.findOneWithId(createTaskDto.milestoneId)
        : null;

      const team = createTaskDto.assigneeId
        ? await this.teamService.findOne(createTaskDto.assigneeId)
        : null;
      
      // Create the task
      const task = this.taskRepository.create({
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        due_date: createTaskDto.dueDate,
        priority: createTaskDto.priority,
        project: project,
        teams: team ? [team] : [],
        milestone: milestone
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

  async getProjectDetails(projectName: string): Promise<Project> {
    this.logger.log(`Initiating to find project`)
    const project = await this.projectRepository.findOne({ where: { name: projectName }, relations: ['tasks', 'teams', 'client'] });
    this.logger.log(`Project found: ${project.name}`);
    return project;
  };

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

  async updateTeamProject(updateTeamDto: UpdateTeamDto): Promise<any> {
    this.logger.log(
      `Updating teams for project: ${updateTeamDto.project_id}`,
    );
    try {
      if (!updateTeamDto.team_id || updateTeamDto.team_id.length === 0) {
        throw new HttpException('No teams provided', HttpStatus.BAD_REQUEST);
      }

      const project = await this.projectRepository.findOne({
        where: { id: updateTeamDto.project_id },
        relations: ['teams'],
      });

      if (!project) {
        throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
      }

      const teams = await this.teamService.findTeams(updateTeamDto.team_id);
      if (teams.length !== updateTeamDto.team_id.length) {
        throw new HttpException(
          'One or more teams not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      project.teams = teams;
      const result = await this.projectRepository.save(project);
      this.logger.log(`Project teams updated successfully.`);

      return {
        message: 'Project teams updated successfully.',
        project: result,
      };
    } catch (error) {
      this.logger.error(
        `Error updating project teams: ${updateTeamDto.project_id}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async deleteTask(id: string) {
    this.logger.log(`Deleting task: ${id}`);
    try {
      const task = await this.taskRepository.findOne({
        where: { id },
        relations: ['teams'],
      });

      await this.taskRepository.manager.transaction(async (manager) => {
        if (task.teams?.length) {
          await manager
            .createQueryBuilder()
            .relation(Task, 'teams')
            .of(task)
            .remove(task.teams);
        }

        await manager.remove(Task, task);
      });

      this.logger.log(`Task deleted successfully.`);
      return { message: 'Task deleted successfully.' };
    } catch (error) {
      this.logger.error(`Error deleting task: ${id}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }


  findOneWithBusiness(id: string) {
    return this.projectRepository.findOne({
      where: { id },
      relations: ['business']
    });
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

  findProjectsById(id: string) { 
    const project = this.projectRepository.findOne({where:{id}, relations: ['business']});
    if(project){
      return project;
    }
    return false;
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
        relations: ['project', 'project.business', 'teams'],
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

  async findProjectsByTeams(teamIds: string[]): Promise<Project[]> {
    if (!teamIds || teamIds.length === 0) return [];
    
    const projects = await this.projectRepository.find({
      where: { teams: { id: In(teamIds) } },
    });
    return projects;
  }
}
