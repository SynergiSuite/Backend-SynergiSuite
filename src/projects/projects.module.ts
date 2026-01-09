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

@Module({
  imports: [TypeOrmModule.forFeature([Project, Task]), forwardRef(() => UserModule), forwardRef(() => ClientsModule), BusinessModule, TeamsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService]
})
export class ProjectsModule {}
