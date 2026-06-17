import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { CategoryModule } from './category/category.module';
import { RolesModule } from './roles/roles.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { ClientsModule } from './clients/clients.module';
import { MilestoneModule } from './milestone/milestone.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { ScheduleModule } from '@nestjs/schedule';


@Module({
  imports: [
    UserModule, AuthModule, BusinessModule, CategoryModule, RolesModule, 
    TeamsModule, ProjectsModule, ClientsModule, MilestoneModule, DocumentsModule,
    HealthModule, ScheduleModule.forRoot()
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
