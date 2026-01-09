import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { projectCreationGuard, roleGuard, validRequestForTask, validRequestForTaskUpdate } from './project.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import { JwtGuard } from 'src/shared/auth.guard';
import { Request } from 'express';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

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

  @Get("get-all-tasks-for-projects")
  @UseGuards(JwtGuard, IsVerifiedGuard)
  findAllTasksForProjects(@Query('projectId') projectId: string) {
    return this.projectsService.getProjects(projectId);
  }

  @Post("create-task")
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, validRequestForTask)
  createTask(@Req() req: Request, @Body() createTaskDto: CreateTaskDto) {
    return this.projectsService.createTask(req.user, createTaskDto);
  }

  @Post("update-task")
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, validRequestForTaskUpdate)
  updateTask(@Req() req: Request, @Body() updateTaskDto: UpdateTaskDto) {
    return this.projectsService.updateTask(updateTaskDto);
  }

  @Post("get-all-project-teams")
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard)
  getProjectTeams(@Req() req: Request, @Body("id") id: string) {
    return this.projectsService.getProjectTeams(req.user, id);
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
