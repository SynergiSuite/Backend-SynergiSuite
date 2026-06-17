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
import { projectCreationGuard, projectTeamsUpdateGuard, roleGuard, ValidProjectGuard, validRequestForTask, validRequestForTaskDelete, validRequestForTaskList, validRequestForTaskUpdate } from './project.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Task]), forwardRef(() => UserModule), forwardRef(() => ClientsModule), BusinessModule, TeamsModule, MilestoneModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, roleGuard, projectCreationGuard, projectTeamsUpdateGuard, validRequestForTask, validRequestForTaskUpdate, validRequestForTaskDelete, validRequestForTaskList, ValidProjectGuard],
  exports: [ProjectsService]
})
export class ProjectsModule {}
