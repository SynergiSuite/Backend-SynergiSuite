import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserHelper } from '../user/user.helper';
import { TeamsService } from '../teams/teams.service';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { ClientsService } from 'src/clients/clients.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { MilestoneService } from 'src/milestone/milestone.service';
import { GroupService } from '../collab_station/services/group.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { ActivityService } from '../activity/activity.service';
import { getAccessRoleName } from '../roles/role-access';
import { ProjectsHelper } from './projects.helper';
import { ProjectNotificationsService } from './project-notifications.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(
    private readonly projectsHelper: ProjectsHelper,
    private readonly userHelper: UserHelper,
    private readonly teamService: TeamsService,
    private readonly clientService: ClientsService,
    private readonly milestoneService: MilestoneService,
    @Inject(forwardRef(() => GroupService))
    private readonly groupService: GroupService,
    private readonly projectNotifications: ProjectNotificationsService,
    private readonly activityService: ActivityService,
  ) {}

  // This Function creates new projects.
  async create(reqObj: any, createProjectDto: CreateProjectDto) {
    this.logger.log(`Creating a new project: ${createProjectDto.name}`);
    try {
      this.logger.log(`Finding Business`);
      const creator = await this.userHelper.getUserWithBusinessDetail(
        reqObj.email,
      );
      const business = creator?.business;
      const businessId = business?.business_id;
      if (!businessId) {
        throw new HttpException(
          'User does not have a registered business.',
          HttpStatus.BAD_REQUEST,
        );
      }
      this.logger.log(`Finding Teams`);
      const teams = await this.teamService.findTeams(createProjectDto.teams);
      if (
        teams.length !== createProjectDto.teams.length ||
        teams.some((team) => team.business?.business_id !== businessId)
      ) {
        throw new HttpException(
          'One or more selected teams were not found for this business.',
          HttpStatus.BAD_REQUEST,
        );
      }
      this.logger.log(`Finding Client`);
      const client = await this.clientService.findOneClientThroughId(
        createProjectDto.client,
      );
      if (!client) {
        throw new HttpException('Client not found.', HttpStatus.NOT_FOUND);
      }
      if (client.business?.business_id !== businessId) {
        throw new HttpException(
          'Client does not belong to this business.',
          HttpStatus.BAD_REQUEST,
        );
      }
      this.logger.log(`Creating Project`);
      const result = await this.projectsHelper.createProject({
        name: createProjectDto.name,
        description: createProjectDto.description,
        status: createProjectDto.status,
        duration: createProjectDto.duration,
        business,
        client,
        teams,
      });
      this.logger.log(`Project created successfully.`);
      this.logger.log(
        `Project persisted | projectId=${result.id} | businessId=${businessId} | teamCount=${result.teams?.length ?? 0}`,
      );

      // Create a collab_station group for this project with all team members
      const allTeamMemberUserIds: number[] = [];
      for (const team of teams) {
        const teamMembers = await this.teamService.findTeamMember(team.id);
        for (const tm of teamMembers) {
          if (!allTeamMemberUserIds.includes(tm.user.user_id)) {
            allTeamMemberUserIds.push(tm.user.user_id);
          }
        }
      }
      // Also include the creator
      if (!allTeamMemberUserIds.includes(creator.user_id)) {
        allTeamMemberUserIds.push(creator.user_id);
      }
      await this.groupService.createGroupForProject(
        result.id,
        result.name,
        creator.user_id,
        allTeamMemberUserIds,
      );

      await this.activityService.log({
        action: ActivityAction.CREATED,
        module: 'projects',
        entityType: 'Project',
        entityId: result.id,
        entityName: result.name,
        actor: creator,
        after: {
          id: result.id,
          name: result.name,
          description: result.description,
          status: result.status,
          duration: result.duration,
          clientId: result.client?.id,
        },
      });

      return {
        message: 'New project created successfully.',
        project: result,
      };
    } catch (error) {
      this.logger.error(
        `Error creating project: ${createProjectDto.name}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // This function finds all Projects respective of their business.
  async findAllByBusiness(
    reqObj: any,
    requestedRole?: string,
    pagination: { page?: number; search?: string; paginate?: boolean } = {},
  ) {
    this.logger.log(`Getting all projects for business: ${reqObj.email}`);
    try {
      this.logger.log(`Finding Business`);
      const user = await this.userHelper.getUserWithBusinessDetail(
        reqObj.email,
      );
      const businessId = user.business.business_id;
      const actualRole = getAccessRoleName(user.role);
      const frontendRole = requestedRole?.toLowerCase();
      const page = Number(pagination.page) > 0 ? Number(pagination.page) : 1;
      const search = pagination.search?.trim();

      if (actualRole === 'founder' || actualRole === 'manager') {
        this.logger.log(
          `Getting all projects for business: ${businessId} | role=${actualRole} | frontendRole=${frontendRole ?? 'none'}`,
        );
      } else if (actualRole === 'client') {
        this.logger.log(
          `Getting client projects for business: ${businessId} | user=${reqObj.email} | frontendRole=${frontendRole ?? 'none'}`,
        );
      } else {
        this.logger.log(
          `Getting team-linked projects for business: ${businessId} | user=${reqObj.email} | role=${actualRole ?? 'none'} | frontendRole=${frontendRole ?? 'none'}`,
        );
      }

      return this.projectsHelper.findVisibleProjects({
        businessId,
        role: actualRole,
        userId: user.user_id,
        userEmail: user.email,
        search,
        page,
        paginate: pagination.paginate !== false,
      });
    } catch (error) {
      this.logger.error(
        `Error getting all projects for business: ${reqObj.email}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async findAllForBusiness(data: any) {
    this.logger.log(`Getting minimal projects for business: ${data.email}`);
    try {
      const user = await this.userHelper.getUserWithBusinessDetail(data.email);
      const businessId = user.business.business_id;

      const projects =
        await this.projectsHelper.findMinimalByBusiness(businessId);

      return { data: projects };
    } catch (error) {
      this.logger.error(
        `Error getting minimal projects for business: ${data.email}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async createTask(reqObj: any, createTaskDto: CreateTaskDto): Promise<any> {
    this.logger.log(`Creating task: ${createTaskDto.title}`);
    try {
      const actor = await this.userHelper.getUserWithBusinessDetail(
        reqObj.email,
      );
      // Project/business validation handled by guards.
      const project = await this.projectsHelper.findProject(
        createTaskDto.projectId,
        ['business'],
      );

      const milestone = createTaskDto.milestoneId
        ? await this.milestoneService.findOneWithId(createTaskDto.milestoneId)
        : null;

      const team = createTaskDto.assigneeId
        ? await this.teamService.findOne(createTaskDto.assigneeId)
        : null;

      // Create the task
      const task = this.projectsHelper.createTask({
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        dueDate: createTaskDto.dueDate,
        priority: createTaskDto.priority,
        project: project,
        teams: team ? [team] : [],
        milestone: milestone,
      });

      const result = await this.projectsHelper.saveTask(task);
      this.logger.log(`Task created successfully.`);

      // Notifications should not depend on audit logging.
      this.projectNotifications
        .notifyTaskTeam(result.id, 'created')
        .catch((err) => {
          this.logger.error(
            `[TaskNotification] Background email dispatch failed for taskId=${result.id} | error=${err.message}`,
            err.stack,
          );
        });

      this.activityService
        .log({
          action: ActivityAction.CREATED,
          module: 'tasks',
          entityType: 'Task',
          entityId: result.id,
          entityName: result.title,
          actor,
          businessId: project.business.business_id,
          after: {
            id: result.id,
            title: result.title,
            description: result.description,
            status: result.status,
            priority: result.priority,
            due_date: result.due_date,
            projectId: project.id,
          },
        })
        .catch((err) => {
          this.logger.error(
            `[ActivityLog] Failed to log task creation for taskId=${result.id} | error=${err.message}`,
            err.stack,
          );
        });

      return {
        message: 'New task created successfully.',
        task: result,
      };
    } catch (error) {
      this.logger.error(
        `Error creating task: ${createTaskDto.title}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async getProjectDetails(projectName: string): Promise<Project> {
    this.logger.log(`Initiating to find project`);
    const project = await this.projectsHelper.findProjectByName(projectName, [
      'tasks',
      'teams',
      'client',
    ]);
    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }
    this.logger.log(`Project found: ${project.name}`);
    return project;
  }

  async updateTask(updateTaskDto: UpdateTaskDto, reqObj: any): Promise<any> {
    this.logger.log(`Getting task for updating with id: ${updateTaskDto.id}`);
    try {
      const actor = await this.userHelper.getUserWithBusinessDetail(
        reqObj.email,
      );
      const task = await this.findOneTask(updateTaskDto.id);
      const before = {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
      };

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

      const result = await this.projectsHelper.saveTask(task);
      this.logger.log(`Task updated successfully.`);
      const after = {
        title: result.title,
        description: result.description,
        status: result.status,
        priority: result.priority,
        due_date: result.due_date,
      };

      // Notifications should not depend on audit logging.
      this.projectNotifications
        .notifyTaskTeam(result.id, 'updated')
        .catch((err) => {
          this.logger.error(
            `[TaskNotification] Background email dispatch failed for taskId=${result.id} | error=${err.message}`,
            err.stack,
          );
        });

      this.activityService
        .logFieldChanges(
          {
            action: ActivityAction.UPDATED,
            module: 'tasks',
            entityType: 'Task',
            entityId: result.id,
            entityName: result.title,
            actor,
            businessId: task.project.business.business_id,
          },
          before,
          after,
          ['title', 'description', 'status', 'priority', 'due_date'],
        )
        .catch((err) => {
          this.logger.error(
            `[ActivityLog] Failed to log task update for taskId=${result.id} | error=${err.message}`,
            err.stack,
          );
        });

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
      const project = await this.projectsHelper.findProject(token, [
        'tasks',
        'tasks.teams',
      ]);

      if (!project) {
        throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
      }

      return project.tasks;
    } catch (error) {
      this.logger.error(
        `Error getting projects for token: ${token}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async getProjectTeams(reqObj: any, projectId: string): Promise<any> {
    this.logger.log(`Getting project teams for project: ${projectId}`);
    try {
      const project = await this.projectsHelper.findProject(projectId, [
        'teams',
      ]);

      if (!project) {
        throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
      }

      return project.teams;
    } catch (error) {
      this.logger.error(
        `Error getting project teams: ${projectId}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async updateTeamProject(updateTeamDto: UpdateTeamDto): Promise<any> {
    this.logger.log(`Updating teams for project: ${updateTeamDto.project_id}`);
    try {
      if (!updateTeamDto.team_id || updateTeamDto.team_id.length === 0) {
        throw new HttpException('No teams provided', HttpStatus.BAD_REQUEST);
      }

      const project = await this.projectsHelper.findProject(
        updateTeamDto.project_id,
        ['teams'],
      );

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
      const result = await this.projectsHelper.saveProject(project);
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

  async deleteTask(id: string, reqObj: any) {
    this.logger.log(`Deleting task: ${id}`);
    try {
      const actor = await this.userHelper.getUserWithBusinessDetail(
        reqObj.email,
      );
      const task = await this.projectsHelper.findTask(id);

      if (!task) {
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
      }

      const before = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        projectId: task.project?.id,
      };

      await this.projectsHelper.deleteTask(task);

      this.logger.log(`Task deleted successfully.`);
      await this.activityService.log({
        action: ActivityAction.DELETED,
        module: 'tasks',
        entityType: 'Task',
        entityId: task.id,
        entityName: task.title,
        actor,
        businessId: task.project?.business?.business_id,
        before,
      });

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
    return this.projectsHelper.findProject(id, ['business']);
  }

  findOneByNameAndBusiness(name: string, businessId: number) {
    return this.projectsHelper.findProjectByNameForBusiness(name, businessId);
  }

  async update(id: string, updateProjectDto: UpdateProjectDto, reqObj: any) {
    this.logger.log(`Updating project: ${id} for user: ${reqObj.email}`);
    try {
      const user = await this.userHelper.getUserWithBusinessDetail(
        reqObj.email,
      );
      const businessId = user.business.business_id;

      const project = await this.projectsHelper.findProjectForBusiness(
        id,
        businessId,
      );

      if (!project) {
        throw new HttpException('Project not found.', HttpStatus.NOT_FOUND);
      }

      if (
        updateProjectDto.name !== undefined &&
        updateProjectDto.name !== project.name
      ) {
        const existingProject =
          await this.projectsHelper.findProjectByNameForBusiness(
            updateProjectDto.name,
            businessId,
          );

        if (existingProject && existingProject.id !== project.id) {
          throw new HttpException(
            'Project with this name already exists.',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const before = {
        name: project.name,
        description: project.description,
        status: project.status,
        duration: project.duration,
      };

      if (updateProjectDto.name !== undefined) {
        project.name = updateProjectDto.name;
      }

      if (updateProjectDto.description !== undefined) {
        project.description = updateProjectDto.description;
      }

      if (updateProjectDto.status !== undefined) {
        project.status = updateProjectDto.status;
      }

      if (updateProjectDto.duration !== undefined) {
        project.duration = updateProjectDto.duration;
      }

      const result = await this.projectsHelper.saveProject(project);
      this.logger.log(`Project updated successfully: ${id}`);
      const after = {
        name: result.name,
        description: result.description,
        status: result.status,
        duration: result.duration,
      };

      await this.activityService.logFieldChanges(
        {
          action: ActivityAction.UPDATED,
          module: 'projects',
          entityType: 'Project',
          entityId: result.id,
          entityName: result.name,
          actor: user,
          businessId,
        },
        before,
        after,
        ['name', 'description', 'status', 'duration'],
      );

      return {
        message: 'Project updated successfully.',
        project: result,
      };
    } catch (error) {
      this.logger.error(`Error updating project: ${id}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async remove(id: string, reqObj: any) {
    this.logger.log(`Deleting project: ${id} for user: ${reqObj.email}`);
    try {
      const user = await this.userHelper.getUserWithBusinessDetail(
        reqObj.email,
      );
      const businessId = user.business.business_id;

      const project = await this.projectsHelper.findProjectForBusiness(
        id,
        businessId,
        ['business', 'teams', 'tasks', 'tasks.teams'],
      );

      if (!project) {
        throw new HttpException('Project not found.', HttpStatus.NOT_FOUND);
      }

      const before = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        duration: project.duration,
        taskCount: project.tasks?.length ?? 0,
        teamCount: project.teams?.length ?? 0,
      };

      await this.projectsHelper.deleteProject(project);

      this.logger.log(`Project deleted successfully: ${id}`);
      await this.activityService.log({
        action: ActivityAction.DELETED,
        module: 'projects',
        entityType: 'Project',
        entityId: project.id,
        entityName: project.name,
        actor: user,
        businessId,
        before,
      });

      return { message: 'Project deleted successfully.' };
    } catch (error) {
      this.logger.error(`Error deleting project: ${id}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Helper Functions
  async findProjectsName(name: string, businessId?: number): Promise<boolean> {
    const project = businessId
      ? await this.projectsHelper.findProjectByNameForBusiness(name, businessId)
      : await this.projectsHelper.findProjectByName(name);
    return !project;
  }

  async findProjectsById(id: string) {
    return this.projectsHelper.findProject(id, ['business']);
  }

  findAll() {
    try {
      this.logger.log(`Getting all projects`);
      return this.projectsHelper.findAllProjects();
    } catch (error) {
      this.logger.error(`Error getting all projects`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async findOneTask(id: string): Promise<Task> {
    this.logger.log(`Getting task: ${id}`);
    try {
      const task = await this.projectsHelper.findTask(id);

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

    return this.projectsHelper.findProjectsByTeams(teamIds);
  }
}
