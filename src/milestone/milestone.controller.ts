import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Logger } from '@nestjs/common';
import { MilestoneService } from './milestone.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { roleGuard, ValidProjectForBusiness, ValidRequestForMilestonesCreation, ValidRequestForMilestoneUpdation } from './milestone.guard';

@Controller('milestone')
export class MilestoneController {
  private readonly logger = new Logger(MilestoneController.name);

  constructor(private readonly milestoneService: MilestoneService) {}

  @Post('/create')
  @UseGuards(JwtGuard, roleGuard, ValidRequestForMilestonesCreation)
  async create(@Body() createMilestoneDto: CreateMilestoneDto) {
    this.logger.log(`Received create milestone request: ${createMilestoneDto.name}`);
    return this.milestoneService.create(createMilestoneDto);
  }

  @Get()
  @UseGuards(JwtGuard, ValidProjectForBusiness)
  findAllMilestoneForProject(@Query('projectId') projectId?: string) {
    this.logger.log(`Fetching milestones using query param. projectId: ${projectId ?? 'none'}`);
    return this.milestoneService.findAll(projectId);
  }

  @Get('project/:projectId')
  @UseGuards(JwtGuard, ValidProjectForBusiness)
  findAllMilestoneForProjectPath(@Param('projectId') projectId: string) {
    this.logger.log(`Fetching milestones using project path. projectId: ${projectId}`);
    return this.milestoneService.findAll(projectId);
  }

  @Get(':projectId')
  @UseGuards(JwtGuard, ValidProjectForBusiness)
  findAllMilestoneForLegacyPath(@Param('projectId') projectId: string) {
    this.logger.log(`Fetching milestones using legacy path. projectId: ${projectId}`);
    return this.milestoneService.findAll(projectId);
  }

  @Post('/update-milestone')
  @UseGuards(JwtGuard, roleGuard, ValidRequestForMilestoneUpdation)
  update(@Body() updateMilestoneDto: UpdateMilestoneDto) {
    this.logger.log(`Received update milestone request: ${updateMilestoneDto.id}`);
    return this.milestoneService.update(updateMilestoneDto);
  }

  @Get('details/:id')
  findOne(@Param('id') id: string) {
    this.logger.log(`Fetching milestone details: ${id}`);
    return `this.milestoneService.findOneWithName(id)`;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.logger.log(`Received delete milestone request: ${id}`);
    return this.milestoneService.remove(+id);
  }
}
