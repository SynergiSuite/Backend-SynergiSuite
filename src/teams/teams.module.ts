import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team_members.entity';
import { UserModule } from 'src/user/user.module';
import {
  AddTeamMembersGuard,
  CreateTeamGuard,
  RemoveTeamMembersGuard,
  roleGuard,
  validAuthorizationGuard,
} from './team.guard';
import { CollabStationModule } from '../collab_station/collab_station.module';
import { ActivityModule } from '../activity/activity.module';
import { TeamsHelper } from './teams.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember]),
    UserModule,
    forwardRef(() => CollabStationModule),
    ActivityModule,
  ],
  controllers: [TeamsController],
  providers: [
    TeamsService,
    TeamsHelper,
    CreateTeamGuard,
    validAuthorizationGuard,
    roleGuard,
    AddTeamMembersGuard,
    RemoveTeamMembersGuard,
  ],
  exports: [TeamsService],
})
export class TeamsModule {}
