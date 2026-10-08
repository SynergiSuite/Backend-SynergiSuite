import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { Client } from '../clients/entities/client.entity';
import { Milestone } from '../milestone/entities/milestone.entity';
import { Team } from '../teams/entities/team.entity';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';

export interface ProjectListOptions {
  businessId: number;
  role?: string;
  userId: number;
  userEmail: string;
  search?: string;
  page: number;
  paginate: boolean;
}

export interface CreateProjectRecord {
  name: string;
  description?: string;
  status?: number;
  duration?: string;
  business: Business;
  client: Client;
  teams: Team[];
}

export interface CreateTaskRecord {
  title: string;
  description?: string;
  status?: any;
  dueDate?: any;
  priority?: any;
  project: Project;
  teams: Team[];
  milestone?: Milestone | null;
}

@Injectable()
export class ProjectsHelper {
  private readonly pageSize = 9;

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async createProject(input: CreateProjectRecord): Promise<Project> {
    return this.projectRepository.manager.transaction(async (manager) => {
      const project = manager.create(Project, {
        name: input.name,
        description: input.description,
        status: input.status,
        duration: input.duration,
        business: input.business,
        client: input.client,
      });
      const savedProject = await manager.save(Project, project);

      await manager
        .createQueryBuilder()
        .relation(Project, 'teams')
        .of(savedProject)
        .add(input.teams.map((team) => team.id));

      return manager.findOneOrFail(Project, {
        where: {
          id: savedProject.id,
          business: { business_id: input.business.business_id },
        },
        relations: ['business', 'teams', 'client'],
      });
    });
  }

  async findVisibleProjects(options: ProjectListOptions) {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.tasks', 'tasks')
      .leftJoinAndSelect('project.teams', 'teams')
      .leftJoinAndSelect('project.client', 'client')
      .where('project.business_id = :businessId', {
        businessId: options.businessId,
      })
      .distinct(true);

    if (options.role === 'client') {
      query.andWhere('client.email = :clientEmail', {
        clientEmail: options.userEmail,
      });
    } else if (options.role !== 'founder' && options.role !== 'manager') {
      query
        .leftJoin('teams.members', 'members')
        .leftJoin('members.user', 'memberUser')
        .andWhere('memberUser.user_id = :userId', {
          userId: options.userId,
        });
    }

    if (options.search) {
      query.andWhere(
        '(project.name ILIKE :search OR project.description ILIKE :search OR client.name ILIKE :search OR client.company ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    query.orderBy('project.created_at', 'DESC');

    if (!options.paginate) return query.getMany();

    const [projects, totalItems] = await query
      .skip((options.page - 1) * this.pageSize)
      .take(this.pageSize)
      .getManyAndCount();

    return {
      data: projects,
      meta: {
        totalItems,
        itemCount: projects.length,
        itemsPerPage: this.pageSize,
        currentPage: options.page,
        totalPages: Math.ceil(totalItems / this.pageSize),
      },
    };
  }

  async findMinimalByBusiness(businessId: number): Promise<Project[]> {
    return this.projectRepository
      .createQueryBuilder('project')
      .select([
        'project.id',
        'project.name',
        'project.status',
        'project.duration',
      ])
      .where('project.business_id = :businessId', { businessId })
      .orderBy('project.created_at', 'DESC')
      .getMany();
  }

  createTask(input: CreateTaskRecord): Task {
    return this.taskRepository.create({
      title: input.title,
      description: input.description,
      status: input.status,
      due_date: input.dueDate,
      priority: input.priority,
      project: input.project,
      teams: input.teams,
      milestone: input.milestone,
    });
  }

  saveTask(task: Task): Promise<Task> {
    return this.taskRepository.save(task);
  }

  saveProject(project: Project): Promise<Project> {
    return this.projectRepository.save(project);
  }

  findProject(id: string, relations: string[] = ['business']) {
    return this.projectRepository.findOne({ where: { id }, relations });
  }

  findProjectByName(name: string, relations: string[] = []) {
    return this.projectRepository.findOne({ where: { name }, relations });
  }

  findProjectForBusiness(
    id: string,
    businessId: number,
    relations: string[] = ['business'],
  ) {
    return this.projectRepository.findOne({
      where: { id, business: { business_id: businessId } },
      relations,
    });
  }

  findProjectByNameForBusiness(name: string, businessId: number) {
    return this.projectRepository.findOne({
      where: { name, business: { business_id: businessId } },
      relations: ['business'],
    });
  }

  findTask(id: string) {
    return this.taskRepository.findOne({
      where: { id },
      relations: ['project', 'project.business', 'teams'],
    });
  }

  findAllProjects() {
    return this.projectRepository.find({ relations: ['tasks'] });
  }

  findProjectsByTeams(teamIds: string[]) {
    if (teamIds.length === 0) return Promise.resolve([]);
    return this.projectRepository.find({
      where: { teams: { id: In(teamIds) } },
    });
  }

  async deleteTask(task: Task): Promise<void> {
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
  }

  async deleteProject(project: Project): Promise<void> {
    await this.projectRepository.manager.transaction(async (manager) => {
      for (const task of project.tasks ?? []) {
        if (task.teams?.length) {
          await manager
            .createQueryBuilder()
            .relation(Task, 'teams')
            .of(task)
            .remove(task.teams);
        }
      }

      if (project.teams?.length) {
        await manager
          .createQueryBuilder()
          .relation(Project, 'teams')
          .of(project)
          .remove(project.teams);
      }

      await manager.remove(Project, project);
    });
  }
}
