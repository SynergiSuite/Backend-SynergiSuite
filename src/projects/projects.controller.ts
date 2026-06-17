import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { projectCreationGuard, projectTeamsUpdateGuard, roleGuard, ValidProjectGuard, validRequestForTask, validRequestForTaskDelete, validRequestForTaskList, validRequestForTaskUpdate } from './project.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import { JwtGuard } from 'src/shared/auth.guard';
import { Request } from 'express';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post("create-new-project")
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, projectCreationGuard)
  create(@Req() req: Request, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(req.user, createProjectDto);
  }

  @Post("update-project-teams")
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, projectTeamsUpdateGuard)
  updateProjectTeams(@Body() updateTeamDto: UpdateTeamDto) {
    return this.projectsService.updateTeamProject(updateTeamDto);
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

  @Get("get-project-details")
  @UseGuards(JwtGuard, IsVerifiedGuard, ValidProjectGuard)
  getProjectDetails(@Req() req: Request, @Query('projectName') projectName: string) {
    return this.projectsService.getProjectDetails(projectName);
  }

  @Get("get-all-tasks-for-projects")
  @UseGuards(JwtGuard, IsVerifiedGuard, validRequestForTaskList)
  findAllTasksForProjects(@Query('projectId') projectId: string) {
    return this.projectsService.getProjects(projectId);
  }

  @Post("create-task")
  @UseGuards(JwtGuard, IsVerifiedGuard, validRequestForTask)
  createTask(@Req() req: Request, @Body() createTaskDto: CreateTaskDto) {
    return this.projectsService.createTask(req.user, createTaskDto);
  }

  @Post("update-task")
  @UseGuards(JwtGuard, IsVerifiedGuard, validRequestForTaskUpdate)
  updateTask(@Req() req: Request, @Body() updateTaskDto: UpdateTaskDto) {
    return this.projectsService.updateTask(updateTaskDto);
  }

  @Delete("delete-task/:id")
  @UseGuards(JwtGuard, IsVerifiedGuard, validRequestForTaskDelete)
  deleteTask(@Param('id') id: string) {
    return this.projectsService.deleteTask(id);
  }

  @Post("get-all-project-teams")
  @UseGuards(JwtGuard, IsVerifiedGuard)
  getProjectTeams(@Req() req: Request, @Body("id") id: string) {
    return this.projectsService.getProjectTeams(req.user, id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return `this.projectsService.findOne(+id)`;
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
