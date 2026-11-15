import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../projects/entities/task.entity';
import { UserHelper } from '../user/user.helper';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { Milestone } from './entities/milestone.entity';

@Injectable()
export class MilestoneHelper {
  private readonly logger = new Logger(MilestoneHelper.name);

  constructor(
    @InjectRepository(Milestone)
    private readonly milestoneRepository: Repository<Milestone>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly userHelper: UserHelper,
  ) {}

  async getUserWithBusiness(email: string) {
    return this.userHelper.getUserWithBusinessDetail(email);
  }

  async findProjectForBusiness(
    projectId: string,
    businessId?: number,
  ): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: {
        id: projectId,
        business: { business_id: businessId },
      },
      relations: ['business'],
    });
  }

  createMilestone(
    createMilestoneDto: CreateMilestoneDto,
    project: Project,
  ): Milestone {
    return this.milestoneRepository.create({
      name: createMilestoneDto.name,
      end_date: createMilestoneDto.endDate,
      project,
    });
  }

  async saveMilestone(milestone: Milestone): Promise<Milestone> {
    return this.milestoneRepository.save(milestone);
  }

  async findMilestonesByProject(projectId?: string): Promise<Milestone[]> {
    return this.milestoneRepository.find({
      where: projectId ? { project: { id: projectId } } : { project: null },
      relations: ['tasks', 'project'],
    });
  }

  async findOneWithName(
    name: string,
    projectId: string,
  ): Promise<Milestone | null> {
    return this.milestoneRepository.findOne({
      where: { name, project: { id: projectId } },
    });
  }

  async findOneWithId(id: string): Promise<Milestone | null> {
    return this.milestoneRepository.findOne({ where: { id } });
  }

  async findOneWithBusiness(id: string): Promise<Milestone | null> {
    return this.milestoneRepository.findOne({
      where: { id },
      relations: ['project', 'project.business'],
    });
  }

  async findMilestoneWithDetails(id: string): Promise<Milestone | null> {
    return this.milestoneRepository.findOne({
      where: { id },
      relations: ['project', 'project.business', 'tasks'],
    });
  }

  async findSavedMilestone(
    milestoneId: string,
    projectId: string,
  ): Promise<Milestone | null> {
    return this.milestoneRepository.findOne({
      where: {
        id: milestoneId,
        project: { id: projectId },
      },
      relations: ['project', 'tasks'],
    });
  }

  async findMilestoneWithRelations(id: string): Promise<Milestone | null> {
    return this.milestoneRepository.findOne({
      where: { id },
      relations: ['project', 'tasks'],
    });
  }

  async findTasksByProject(
    taskIds: string[],
    projectId: string,
  ): Promise<Task[]> {
    if (!taskIds.length) {
      return [];
    }

    return this.taskRepository.find({
      where: {
        id: In(taskIds),
        project: { id: projectId },
      },
      relations: ['project', 'milestone'],
    });
  }

  async saveTasks(tasks: Task[]): Promise<Task[]> {
    if (!tasks.length) {
      return [];
    }

    return this.taskRepository.save(tasks);
  }

  async removeMilestone(milestone: Milestone): Promise<Milestone> {
    return this.milestoneRepository.remove(milestone);
  }

  async assertMilestoneNameAvailable(
    name: string,
    projectId?: string,
    excludeMilestoneId?: string,
  ): Promise<void> {
    const query = this.milestoneRepository
      .createQueryBuilder('milestone')
      .where('LOWER(milestone.name) = LOWER(:name)', { name });

    if (excludeMilestoneId) {
      query.andWhere('milestone.id != :excludeMilestoneId', {
        excludeMilestoneId,
      });
    }

    if (projectId) {
      query.andWhere('milestone.project_id = :projectId', { projectId });
    } else {
      query.andWhere('milestone.project_id IS NULL');
    }

    const existing = await query.getOne();
    if (existing) {
      this.logger.error(`Milestone already exists: ${name}`);
      throw new ConflictException('Milestone already exists');
    }
  }
}
