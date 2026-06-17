import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team_members.entity';
import { BusinessModule } from 'src/business/business.module';
import { UserModule } from 'src/user/user.module';
import { AddTeamMembersGuard, createTeamGuard, RemoveTeamMembersGuard, roleGuard, teamProgressGuard, validAuthorizationGuard } from './team.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember]),
    BusinessModule,
    UserModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService, createTeamGuard, validAuthorizationGuard, teamProgressGuard, roleGuard, AddTeamMembersGuard, RemoveTeamMembersGuard],
  exports: [TeamsService],
})
export class TeamsModule {}
