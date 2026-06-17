import { Module, forwardRef } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { BusinessModule } from 'src/business/business.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { UserModule } from 'src/user/user.module';
import { checkClientBusiness, createClientGuard, editClientGuard, roleGuard } from './client.guard';
import { Project } from 'src/projects/entities/project.entity';
import { Task } from 'src/projects/entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Project, Task]), BusinessModule, forwardRef(() => ProjectsModule), UserModule],
  controllers: [ClientsController],
  providers: [ClientsService, roleGuard, createClientGuard, checkClientBusiness, editClientGuard],
  exports: [ClientsService],
})
export class ClientsModule {}
