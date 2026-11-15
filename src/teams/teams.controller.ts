import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import {
  AddTeamMembersGuard,
  CreateTeamGuard,
  roleGuard,
  validAuthorizationGuard,
} from './team.guard';
import { CheckHasBusiness } from '../business/business.guard';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // This creates new teams
  @Post('/create')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, CreateTeamGuard)
  create(@Req() req: Request, @Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto, req.user);
  }

  // This gets teams and tasks related to the team of the user. (with pagination)
  @Get('get-all-teams-with-tasks')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, CheckHasBusiness)
  findAllWithTasks(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.teamsService.findAllWithTasks(req.user as any, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // This gets the list of teams
  @Get('get-all-teams')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, CheckHasBusiness)
  findAll(@Req() req: Request) {
    return this.teamsService.findAll(req.user as any);
  }

  // This gets all teams with leader and all members for a business
  @Get('business/:business_id')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, CheckHasBusiness)
  findTeamsWithMembers(
    @Req() req: Request,
    @Param('business_id', ParseIntPipe) businessId: number,
  ) {
    return this.teamsService.findTeamsWithMembersByBusiness(
      businessId,
      req.user as any,
    );
  }

  // Alias endpoint for getting all teams with members by business
  @Get('get-all-teams-with-members/:business_id')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, CheckHasBusiness)
  findAllTeamsWithMembersAlias(
    @Req() req: Request,
    @Param('business_id', ParseIntPipe) businessId: number,
  ) {
    return this.teamsService.findTeamsWithMembersByBusiness(
      businessId,
      req.user as any,
    );
  }

  // This will get team details
  @Get('get-team-details/:team_id')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, validAuthorizationGuard)
  getTeamDetails(@Param('team_id') team_id: string) {
    return this.teamsService.getTeamDetails(team_id);
  }

  // This will get the progress of each team.
  @Get('team-progress/:team_id')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, validAuthorizationGuard)
  getTeamProgress(@Param('team_id') team_id: string) {
    return this.teamsService.getTeamProgress(team_id);
  }

  // This updates teams
  @Post('update-team/:team_id')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    validAuthorizationGuard,
    roleGuard,
    AddTeamMembersGuard,
  )
  updateTeam(
    @Req() req: Request,
    @Body() updateTeamDto: UpdateTeamDto,
    @Param('team_id') team_id: string,
  ) {
    updateTeamDto.id = team_id;
    return this.teamsService.updateTeam(updateTeamDto, req.user);
  }

  // This removes a team
  @Delete('remove-team/:team_id')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, roleGuard)
  removeTeam(@Req() req: Request, @Param('team_id') teamID: string) {
    return this.teamsService.removeTeam(teamID, req.user);
  }
}
