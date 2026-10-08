import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../shared/auth.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtGuard, IsVerifiedGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('employee-productivity')
  getEmployeeProductivity(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getEmployeeProductivity(req.user, query);
  }

  @Get('employees')
  getEmployeesAnalytics(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getEmployeesAnalytics(req.user, query);
  }

  @Get('teams')
  getTeamsAnalytics(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getTeamsAnalytics(req.user, query);
  }

  @Get('details/employees/:userId')
  getEmployeeDetail(
    @Req() req: Request,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getEmployeeDetail(req.user, userId, query);
  }

  @Get('users/:userId/tasks')
  getUserTasksDetail(
    @Req() req: Request,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getUserTasksDetail(req.user, userId, query);
  }

  @Get('users/:userId/scheduled-meetings')
  getUserScheduledMeetings(
    @Req() req: Request,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getUserScheduledMeetings(
      req.user,
      userId,
      query,
    );
  }

  @Get('details/business')
  getBusinessDetail(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getBusinessDetail(req.user, query);
  }

  @Get('details/clients/:clientId')
  getClientDetail(
    @Req() req: Request,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getClientDetail(req.user, clientId, query);
  }

  @Get('details/projects/:projectId')
  getProjectDetail(
    @Req() req: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getProjectDetail(req.user, projectId, query);
  }

  @Get('details/teams/:teamId')
  getTeamDetail(
    @Req() req: Request,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getTeamDetail(req.user, teamId, query);
  }

  @Get('team-execution-velocity')
  getTeamExecutionVelocity(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getTeamExecutionVelocity(req.user, query);
  }

  @Get('quarterly-growth')
  getQuarterlyGrowth(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getQuarterlyGrowth(req.user, query);
  }

  @Get('clients')
  getClientAnalytics(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getClientAnalytics(req.user, query);
  }

  @Get('overview')
  getOverview(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getOverview(req.user, query);
  }

  @Get('indexes')
  getIndexes(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getIndexes(req.user, query);
  }

  @Post('calculate')
  calculateAndStore(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.calculateAndStore(req.user, query);
  }

  @Get('records')
  getRecords(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getRecords(req.user, query);
  }
}
