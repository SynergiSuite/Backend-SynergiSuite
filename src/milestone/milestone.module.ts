import { Module, forwardRef } from '@nestjs/common';
import { MilestoneService } from './milestone.service';
import { MilestoneController } from './milestone.controller';
import { Milestone } from './entities/milestone.entity';
import { DatabaseModule } from 'src/database/database.module';
import { EmailModule } from 'src/mailer/email.module';
import { RolesModule } from 'src/roles/roles.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'src/category/category.module';
import { RedisModule } from 'src/redis/redis.module';
import { RedisService } from 'src/redis/redis.service';
import { UserModule } from 'src/user/user.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { BusinessModule } from 'src/business/business.module';
import { TeamsModule } from 'src/teams/teams.module';
import { Project } from 'src/projects/entities/project.entity';
import { Task } from 'src/projects/entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Milestone, Project, Task]), DatabaseModule, BusinessModule, TeamsModule, RedisModule, UserModule, CategoryModule, RolesModule, forwardRef(() => ProjectsModule)],
    controllers: [MilestoneController],
    providers: [MilestoneService, RedisService],
    exports: [MilestoneService]
})
export class MilestoneModule {}
