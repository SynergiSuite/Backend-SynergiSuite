import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MilestoneService } from './milestone.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import {
  roleGuard,
  ValidProjectForBusiness,
  ValidRequestForMilestoneDeletion,
  ValidRequestForMilestonesCreation,
  ValidRequestForMilestoneUpdation,
} from './milestone.guard';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';

@Controller('milestone')
@UseGuards(FrontendSecretGuard)
export class MilestoneController {
  private readonly logger = new Logger(MilestoneController.name);

  constructor(private readonly milestoneService: MilestoneService) {}

  @Post('/create')
  @UseGuards(JwtGuard, roleGuard, ValidRequestForMilestonesCreation)
  async create(
    @Req() req: Request,
    @Body() createMilestoneDto: CreateMilestoneDto,
  ) {
    this.logger.log(
      `Received create milestone request: ${createMilestoneDto.name}`,
    );
    return this.milestoneService.create(createMilestoneDto, req.user);
  }

  @Get()
  @UseGuards(JwtGuard, ValidProjectForBusiness)
  findAllMilestoneForProject(@Query('projectId') projectId?: string) {
    this.logger.log(
      `Fetching milestones using query param. projectId: ${projectId ?? 'none'}`,
    );
    return this.milestoneService.findAll(projectId);
  }

  @Get('project/:projectId')
  @UseGuards(JwtGuard, ValidProjectForBusiness)
  findAllMilestoneForProjectPath(@Param('projectId') projectId: string) {
    this.logger.log(
      `Fetching milestones using project path. projectId: ${projectId}`,
    );
    return this.milestoneService.findAll(projectId);
  }

  @Get(':projectId')
  @UseGuards(JwtGuard, ValidProjectForBusiness)
  findAllMilestoneForLegacyPath(@Param('projectId') projectId: string) {
    this.logger.log(
      `Fetching milestones using legacy path. projectId: ${projectId}`,
    );
    return this.milestoneService.findAll(projectId);
  }

  @Post('/update-milestone')
  @UseGuards(JwtGuard, roleGuard, ValidRequestForMilestoneUpdation)
  update(@Req() req: Request, @Body() updateMilestoneDto: UpdateMilestoneDto) {
    this.logger.log(`Received update milestone request: ${updateMilestoneDto}`);
    return this.milestoneService.update(updateMilestoneDto, req.user);
  }

  @Get('details/:id')
  findOne(@Param('id') id: string) {
    this.logger.log(`Fetching milestone details: ${id}`);
    return `this.milestoneService.findOneWithName(id)`;
  }

  @Delete(':id')
  @UseGuards(
    JwtGuard,
    IsVerifiedGuard,
    roleGuard,
    ValidRequestForMilestoneDeletion,
  )
  remove(@Req() req: Request, @Param('id') id: string) {
    this.logger.log(`Received delete milestone request: ${id}`);
    return this.milestoneService.remove(id, req.user);
  }
}
