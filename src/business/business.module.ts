import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { Business } from './entities/business.entity';
import { UserModule } from '../user/user.module';
import { CategoryModule } from '../category/category.module';
import { RolesModule } from '../roles/roles.module';
import { EmailModule } from '../mailer/email.module';
import { ActivityModule } from '../activity/activity.module';
import { ActivityLog } from '../activity/entities/activity-log.entity';
import { Call } from '../collab_station/entities/call.entity';
import { Message } from '../collab_station/entities/message.entity';
import { Project } from '../projects/entities/project.entity';
import { TeamMember } from '../teams/entities/team_members.entity';
import { User } from '../user/entities/user.entity';
import { TeamsModule } from '../teams/teams.module';
import { BusinessHelper } from './business.helper';
import {
  BusinessAcceptInvitationGuard,
  BusinessAlreadyExistsGuard,
  CheckHasBusiness,
  BusinessInvitationGuard,
  EmployeeBelongsToBusinessGuard,
  RequestedEmployeeBelongsToBusinessGuard,
  roleGuard,
} from './business.guard';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivityLog,
      Business,
      Call,
      Message,
      Project,
      TeamMember,
      User,
    ]),
    DatabaseModule,
    RedisModule,
    UserModule,
    CategoryModule,
    RolesModule,
    EmailModule,
    ActivityModule,
    TeamsModule,
  ],
  controllers: [BusinessController],
  providers: [
    BusinessService,
    BusinessHelper,
    RedisService,
    BusinessAlreadyExistsGuard,
    BusinessInvitationGuard,
    BusinessAcceptInvitationGuard,
    CheckHasBusiness,
    roleGuard,
    EmployeeBelongsToBusinessGuard,
    RequestedEmployeeBelongsToBusinessGuard,
  ],
  exports: [BusinessService, BusinessHelper],
})
export class BusinessModule {}
