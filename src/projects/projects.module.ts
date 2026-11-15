import { Module, forwardRef } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { UserModule } from 'src/user/user.module';
import { BusinessModule } from 'src/business/business.module';
import { TeamsModule } from 'src/teams/teams.module';
import { ClientsModule } from 'src/clients/clients.module';
import { MilestoneModule } from 'src/milestone/milestone.module';
import {
  projectCreationGuard,
  projectTeamsUpdateGuard,
  projectUpdateGuard,
  roleGuard,
  ValidProjectGuard,
  validRequestForTask,
  validRequestForTaskDelete,
  validRequestForTaskList,
  validRequestForTaskUpdate,
} from './project.guard';
import { CollabStationModule } from '../collab_station/collab_station.module';
import { EmailModule } from '../mailer/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { ProjectsHelper } from './projects.helper';
import { ProjectNotificationsService } from './project-notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Task]),
    forwardRef(() => UserModule),
    forwardRef(() => ClientsModule),
    forwardRef(() => BusinessModule),
    forwardRef(() => TeamsModule),
    MilestoneModule,
    forwardRef(() => CollabStationModule),
    EmailModule,
    NotificationsModule,
    ActivityModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsHelper,
    ProjectNotificationsService,
    roleGuard,
    projectCreationGuard,
    projectTeamsUpdateGuard,
    projectUpdateGuard,
    validRequestForTask,
    validRequestForTaskUpdate,
    validRequestForTaskDelete,
    validRequestForTaskList,
    ValidProjectGuard,
  ],
  exports: [ProjectsService, ProjectsHelper],
})
export class ProjectsModule {}
