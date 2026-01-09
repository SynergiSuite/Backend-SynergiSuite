import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import {  UpdateTeamDto } from './dto/update-team.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import { AddTeamMembersGuard, createTeamGuard, RemoveTeamMembersGuard, roleGuard } from './team.guard';
import { Request } from 'express';
import { checkHasBusiness } from 'src/business/business.guard';
import { validAuthorizationGuard } from './team.guard';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('/create')
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, createTeamGuard)
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Get('get-all-teams')
  @UseGuards(JwtGuard, IsVerifiedGuard, checkHasBusiness)
  findAll(@Req() req: Request) {
    return this.teamsService.findAll(req.user);
  }

  @Post('get-team-details')
  @UseGuards(JwtGuard, IsVerifiedGuard, validAuthorizationGuard)
  getTeamDetails(@Body('team') team_id: string) {
    return this.teamsService.getTeamDetails(team_id);
  }

  @Post('update-team')
  @UseGuards(JwtGuard, IsVerifiedGuard, validAuthorizationGuard, roleGuard, AddTeamMembersGuard)
  updateTeam(@Body() updateTeamDto: UpdateTeamDto) {
    return this.teamsService.updateTeam(updateTeamDto);
  }

  // @Post('update-members')
  // @UseGuards(JwtGuard, IsVerifiedGuard, validAuthorizationGuard, roleGuard, AddTeamMembersGuard)
  // updateMembers(@Body() updateMembersDto: AddMembersDto) {
  //   return this.teamsService.updateMembers(updateMembersDto);
  // }

  @Post('remove-members')
  @UseGuards(JwtGuard, IsVerifiedGuard, validAuthorizationGuard, roleGuard, RemoveTeamMembersGuard)
  removeMembers(@Body() team_id: string, members: []) {
    return this.teamsService.removeMembers(team_id, members);
  }

  @Post('remove-team')
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard)
  removeTeam(@Body('team_id') teamID: string) {
    return this.teamsService.removeTeam(teamID);
  }

}
