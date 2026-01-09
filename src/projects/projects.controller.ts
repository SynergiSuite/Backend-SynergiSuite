import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { projectCreationGuard, roleGuard } from './project.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import { JwtGuard } from '../shared/auth.guard';
import { Request } from 'express';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post("create-new-project")
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, projectCreationGuard)
  create(@Req() req: Request, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(req.user, createProjectDto);
  }

  @Get("get-all-projects")
  @UseGuards(JwtGuard, IsVerifiedGuard)
  findAll() {
    return this.projectsService.findAll();
  }

  @Get("get-projects-by-business")
  @UseGuards(JwtGuard, IsVerifiedGuard)
  findAllByBusiness(@Req() req: Request) {
    return this.projectsService.findAllByBusiness(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(+id, updateProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(+id);
  }
}
