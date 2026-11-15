import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { Project } from 'src/projects/entities/project.entity';
import { ActivityService } from 'src/activity/activity.service';
import { ActivityAction } from 'src/activity/entities/activity-log.entity';
import { MilestoneHelper } from './milestone.helper';

@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);
  constructor(
    private readonly activityService: ActivityService,
    private readonly milestoneHelper: MilestoneHelper,
  ) {}

  async create(createMilestoneDto: CreateMilestoneDto, reqObj?: any) {
    this.logger.log(`Creating new Milestone: ${createMilestoneDto.name}`);
    try {
      const actor = reqObj?.email
        ? await this.milestoneHelper.getUserWithBusiness(reqObj.email)
        : null;
      let project: Project | null = null;
      const projectId = createMilestoneDto.projectId;

      if (!projectId) {
        throw new HttpException(
          'Project ID is required when creating a milestone.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Finding Project`);
      project = await this.milestoneHelper.findProjectForBusiness(
        projectId,
        actor?.business?.business_id,
      );

      if (!project) {
        throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
      }

      await this.milestoneHelper.assertMilestoneNameAvailable(
        createMilestoneDto.name,
        project.id,
      );

      this.logger.log(`Creating Milestone`);
      const milestone = this.milestoneHelper.createMilestone(
        createMilestoneDto,
        project,
      );

      const result = await this.milestoneHelper.saveMilestone(milestone);

      if (createMilestoneDto.taskIds?.length) {
        this.logger.log(`Assigning tasks to milestone`);
        const tasks = await this.milestoneHelper.findTasksByProject(
          createMilestoneDto.taskIds,
          project.id,
        );

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
        await this.milestoneHelper.saveTasks(updatedTasks);
      }

      this.logger.log(`Milestone created successfully.`);
      const savedMilestone = await this.milestoneHelper.findSavedMilestone(
        result.id,
        project.id,
      );

      if (!savedMilestone) {
        throw new HttpException(
          'Milestone was not persisted for the requested project.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await this.activityService.log({
        action: ActivityAction.CREATED,
        module: 'milestones',
        entityType: 'Milestone',
        entityId: savedMilestone.id,
        entityName: savedMilestone.name,
        actor,
        businessId:
          project?.business?.business_id ?? actor?.business?.business_id,
        after: {
          id: savedMilestone.id,
          name: savedMilestone.name,
          end_date: savedMilestone.end_date,
          projectId: savedMilestone.project?.id,
          taskIds: savedMilestone.tasks?.map((task) => task.id) ?? [],
        },
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
      if (error?.code === '23505') {
        throw new ConflictException('Milestone already exists');
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async findAll(id?: string) {
    this.logger.log(`Finding milestones. projectId: ${id ?? 'none'}`);
    const milestones = await this.milestoneHelper.findMilestonesByProject(id);

    if (id) {
      this.logger.log(
        `Found ${milestones.length} milestones for projectId: ${id}`,
      );
      return milestones;
    }

    this.logger.log(`Found ${milestones.length} unassigned milestones.`);
    return milestones;
  }

  findOneWithName(name: string, project_id: string) {
    return this.milestoneHelper.findOneWithName(name, project_id);
  }

  findOneWithId(id: string) {
    return this.milestoneHelper.findOneWithId(id);
  }

  findOneWithBusiness(id: string) {
    return this.milestoneHelper.findOneWithBusiness(id);
  }

  async update(updateMilestoneDto: UpdateMilestoneDto, reqObj?: any) {
    this.logger.log(`Updating milestone: ${updateMilestoneDto.id}`);
    try {
      const actorEmail = reqObj?.email;
      const actor = actorEmail
        ? await this.milestoneHelper.getUserWithBusiness(actorEmail)
        : null;

      const milestone = await this.milestoneHelper.findMilestoneWithDetails(
        updateMilestoneDto.id,
      );

      if (!milestone) {
        this.logger.warn(`Milestone not found: ${updateMilestoneDto.id}`);
        throw new HttpException('Milestone not found', HttpStatus.NOT_FOUND);
      }

      const before = {
        name: milestone.name,
        end_date: milestone.end_date,
        taskIds: milestone.tasks?.map((task) => task.id) ?? [],
      };

      const nextName = updateMilestoneDto.name;
      const nextEndDate =
        updateMilestoneDto.endDate ?? updateMilestoneDto.end_date;

      if (nextName && nextName !== milestone.name) {
        await this.milestoneHelper.assertMilestoneNameAvailable(
          nextName,
          milestone.project?.id,
          milestone.id,
        );
      }

      if (nextName !== undefined) {
        milestone.name = nextName;
      }

      if (nextEndDate !== undefined) {
        milestone.end_date = nextEndDate;
      }

      const savedMilestone =
        await this.milestoneHelper.saveMilestone(milestone);

      if (updateMilestoneDto.taskIds !== undefined) {
        if (!milestone.project?.id) {
          this.logger.error(
            `Cannot assign tasks because milestone has no project: ${milestone.id}`,
          );
          throw new HttpException(
            'Project is required on milestone before assigning tasks.',
            HttpStatus.BAD_REQUEST,
          );
        }

        const selectedTaskIds = updateMilestoneDto.taskIds;
        const tasks = await this.milestoneHelper.findTasksByProject(
          selectedTaskIds,
          milestone.project.id,
        );

        if (tasks.length !== selectedTaskIds.length) {
          this.logger.error(
            `Task mismatch for milestone update. Expected: ${selectedTaskIds.length}, found: ${tasks.length}`,
          );
          throw new HttpException(
            'One or more tasks do not belong to the selected project.',
            HttpStatus.BAD_REQUEST,
          );
        }

        const selectedTaskIdSet = new Set(selectedTaskIds);
        const tasksToUnassign = (milestone.tasks ?? [])
          .filter((task) => !selectedTaskIdSet.has(task.id))
          .map((task) => {
            task.milestone = null;
            return task;
          });

        const tasksToAssign = tasks.map((task) => {
          task.milestone = savedMilestone;
          return task;
        });

        await this.milestoneHelper.saveTasks([
          ...tasksToUnassign,
          ...tasksToAssign,
        ]);
      }

      const milestoneWithRelations =
        await this.milestoneHelper.findMilestoneWithRelations(
          savedMilestone.id,
        );

      if (!milestoneWithRelations) {
        throw new HttpException('Milestone not found', HttpStatus.NOT_FOUND);
      }

      const finalTaskIds = milestoneWithRelations.tasks?.map((t) => t.id) ?? [];
      const after = {
        name: milestoneWithRelations.name,
        end_date: milestoneWithRelations.end_date,
        taskIds: finalTaskIds,
      };

      await this.activityService.logFieldChanges(
        {
          action: ActivityAction.UPDATED,
          module: 'milestones',
          entityType: 'Milestone',
          entityId: milestoneWithRelations.id,
          entityName: milestoneWithRelations.name,
          actor,
          businessId:
            milestone.project?.business?.business_id ??
            actor?.business?.business_id,
        },
        before,
        after,
        ['name', 'end_date', 'taskIds'],
      );

      this.logger.log(
        `Milestone updated successfully: ${updateMilestoneDto.id}`,
      );
      return milestoneWithRelations;
    } catch (error) {
      this.logger.error(
        `Error updating milestone: ${updateMilestoneDto.id}`,
        error.stack || error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      if (error?.code === '23505') {
        throw new ConflictException('Milestone already exists');
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async remove(id: string, reqObj?: any) {
    this.logger.log(`Deleting milestone: ${id}`);
    try {
      const actor = reqObj?.email
        ? await this.milestoneHelper.getUserWithBusiness(reqObj.email)
        : null;

      const milestone = await this.milestoneHelper.findMilestoneWithDetails(id);

      if (!milestone) {
        throw new HttpException('Milestone not found', HttpStatus.NOT_FOUND);
      }

      if (
        actor?.business?.business_id &&
        milestone.project?.business?.business_id !== actor.business.business_id
      ) {
        throw new HttpException(
          'Milestone does not belong to this business.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const before = {
        id: milestone.id,
        name: milestone.name,
        end_date: milestone.end_date,
        projectId: milestone.project?.id,
        taskIds: milestone.tasks?.map((task) => task.id) ?? [],
      };

      if (milestone.tasks?.length) {
        const tasksToUnassign = milestone.tasks.map((task) => {
          task.milestone = null;
          return task;
        });
        await this.milestoneHelper.saveTasks(tasksToUnassign);
      }

      await this.milestoneHelper.removeMilestone(milestone);

      await this.activityService.log({
        action: ActivityAction.DELETED,
        module: 'milestones',
        entityType: 'Milestone',
        entityId: before.id,
        entityName: before.name,
        actor,
        businessId:
          milestone.project?.business?.business_id ??
          actor?.business?.business_id,
        before,
      });

      return {
        message: 'Milestone deleted successfully.',
        milestoneId: id,
      };
    } catch (error) {
      this.logger.error(`Error deleting milestone: ${id}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
