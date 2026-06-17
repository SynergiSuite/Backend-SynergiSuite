import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Milestone } from './entities/milestone.entity';
import { In, Repository } from 'typeorm';
import { BusinessService } from 'src/business/business.service';
import { TeamsService } from 'src/teams/teams.service';
import { UserService } from 'src/user/user.service';
import { Project } from 'src/projects/entities/project.entity';
import { Task } from 'src/projects/entities/task.entity';

@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);
    constructor(
      @InjectRepository(Milestone)
      private readonly milestoneRepository: Repository<Milestone>,
      @InjectRepository(Project)
      private readonly projectRepository: Repository<Project>,
      @InjectRepository(Task)
      private readonly taskRepository: Repository<Task>,
      private readonly userService: UserService,
      private  businessService: BusinessService,
      private readonly teamService: TeamsService,
    ) {}
    
  async create(createMilestoneDto: CreateMilestoneDto) {
    this.logger.log(`Creating new Milestone: ${createMilestoneDto.name}`);
    try {
      let project: Project | null = null;
      if (createMilestoneDto.projectId) {
        this.logger.log(`Finding Project`);
        project = await this.projectRepository.findOne({
          where: { id: createMilestoneDto.projectId },
        });

        if (!project) {
          throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
        }
      }

      this.logger.log(`Creating Milestone`);
      const milestone = this.milestoneRepository.create({
        name: createMilestoneDto.name,
        end_date: createMilestoneDto.endDate,
        project,
      });

      const result = await this.milestoneRepository.save(milestone);

      if (createMilestoneDto.taskIds?.length) {
        if (!createMilestoneDto.projectId) {
          throw new HttpException(
            'Project ID is required when assigning tasks to a milestone.',
            HttpStatus.BAD_REQUEST,
          );
        }

        this.logger.log(`Assigning tasks to milestone`);
        const tasks = await this.taskRepository.find({
          where: {
            id: In(createMilestoneDto.taskIds),
            project: { id: createMilestoneDto.projectId },
          },
          relations: ['project'],
        });

        if (tasks.length !== createMilestoneDto.taskIds.length) {
          throw new HttpException(
            'One or more tasks do not belong to the selected project.',
            HttpStatus.BAD_REQUEST,
          );
        }

        const updatedTasks = tasks.map((task) => {
          task.milestone = result;
          return task;
        });
        await this.taskRepository.save(updatedTasks);
      }

      this.logger.log(`Milestone created successfully.`);
      const savedMilestone = await this.milestoneRepository.findOne({
        where: { id: result.id },
        relations: ['project', 'tasks'],
      });

      return {
        message: 'New milestone created successfully.',
        milestone: savedMilestone,
      };
    } catch (error) {
      this.logger.error(
        `Error creating milestone: ${createMilestoneDto.name}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async findAll(id?: string) {
    this.logger.log(`Finding milestones. projectId: ${id ?? 'none'}`);
    if (id) {
      const milestones = await this.milestoneRepository.find({
        where: { project: { id } },
        relations: ['tasks', 'project'],
      });
      this.logger.log(`Found ${milestones.length} milestones for projectId: ${id}`);
      return milestones;
    }

    const milestones = await this.milestoneRepository.find({
      where: { project: null },
      relations: ['tasks', 'project'],
    });
    this.logger.log(`Found ${milestones.length} unassigned milestones.`);
    return milestones;
  }

  findOneWithName(name: string, project_id: string) {
    return this.milestoneRepository.findOne({ where: { name, project: { id: project_id } } });
  }

  findOneWithId(id: string) {
    return this.milestoneRepository.findOne({ where: {id}});
  }

  async update(updateMilestoneDto: UpdateMilestoneDto) {
    this.logger.log(`Updating milestone: ${updateMilestoneDto.id}`);
    try {
      const milestone = await this.milestoneRepository.findOne({
        where: { id: updateMilestoneDto.id },
        relations: ['project', 'tasks'],
      });

      if (!milestone) {
        throw new HttpException('Milestone not found', HttpStatus.NOT_FOUND);
      }

      const updatedMilestone = this.milestoneRepository.create({
        ...milestone,
        ...updateMilestoneDto,
      });

      const savedMilestone = await this.milestoneRepository.save(updatedMilestone);

      if (updateMilestoneDto.taskIds?.length) {
        if (!milestone.project?.id) {
          this.logger.error(`Cannot assign tasks to milestone without project: ${updateMilestoneDto.id}`);
          throw new HttpException(
            'Project is required on milestone before assigning tasks.',
            HttpStatus.BAD_REQUEST,
          );
        }

        this.logger.log(`Assigning ${updateMilestoneDto.taskIds.length} tasks to milestone: ${updateMilestoneDto.id}`);
        const tasks = await this.taskRepository.find({
          where: {
            id: In(updateMilestoneDto.taskIds),
            project: { id: milestone.project.id },
          },
          relations: ['project', 'milestone'],
        });

        if (tasks.length !== updateMilestoneDto.taskIds.length) {
          this.logger.error(`One or more tasks do not belong to project: ${milestone.project.id}`);
          throw new HttpException(
            'One or more tasks do not belong to the selected project.',
            HttpStatus.BAD_REQUEST,
          );
        }

        const updatedTasks = tasks.map((task) => {
          task.milestone = savedMilestone;
          return task;
        });

        await this.taskRepository.save(updatedTasks);
        this.logger.log(`Tasks assigned successfully to milestone: ${updateMilestoneDto.id}`);
      }

      const milestoneWithRelations = await this.milestoneRepository.findOne({
        where: { id: savedMilestone.id },
        relations: ['project', 'tasks'],
      });

      this.logger.log(`Milestone updated successfully.`);
      return milestoneWithRelations;
    } catch (error) {
      this.logger.error(`Error updating milestone: ${updateMilestoneDto.id}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} milestone`;
  }
}
